import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AcalenAnalysisContract,
  AuditLogEntry,
  BusinessRule,
  CartItem,
  CategoryName,
  DerivedIngredientForecast,
  DiscountType,
  GroupRulePolicy,
  InventoryBatch,
  MovementType,
  NavTab,
  PaymentMethod,
  Product,
  ProductForecastSummary,
  ProductItemType,
  RecipeIngredient,
  Recommendation,
  RoleName,
  SalesOrder,
  StockMovement,
  ToastMessage,
  User,
} from '../types/acalen';
import {
  BASELINE_TODAY_ORDERS,
  BASELINE_TODAY_SALES,
  CATEGORIES,
  DEFAULT_POS_CART,
  INITIAL_AUDIT_LOGS,
  INITIAL_BATCHES,
  INITIAL_GROUP_POLICIES,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_RULES,
  INITIAL_STOCK_MOVEMENTS,
  PRODUCT_FORECASTS,
  REFERENCE_TODAY,
  USERS,
} from '../data/seedData';
import {
  buildServiceContractJSON,
  calculateDerivedIngredientForecasts,
  calculateOrderTotals,
  deductStockFEFO,
  getProductStock,
  restoreStockFromItems,
  runAcalenAnalysis,
} from '../engine/acalenEngine';

const STORAGE_KEY = 'acalen_demo_v3';

interface PersistedState {
  currentUserId: number | null;
  activeTab: NavTab;
  products: Product[];
  batches: InventoryBatch[];
  groupPolicies: GroupRulePolicy[];
  rules: BusinessRule[];
  stockMovements: StockMovement[];
  orders: SalesOrder[];
  cart: CartItem[];
  forecasts: ProductForecastSummary[];
  recommendations: Recommendation[];
  auditLogs: AuditLogEntry[];
  lastAnalysisRunAt: string;
}

function createInitialPersistedState(): PersistedState {
  const initialRecommendations = runAcalenAnalysis(
    INITIAL_PRODUCTS,
    INITIAL_BATCHES,
    INITIAL_RULES,
    PRODUCT_FORECASTS,
    [],
    REFERENCE_TODAY,
    INITIAL_GROUP_POLICIES
  );

  return {
    currentUserId: null,
    activeTab: 'dashboard',
    products: INITIAL_PRODUCTS,
    batches: INITIAL_BATCHES,
    groupPolicies: INITIAL_GROUP_POLICIES,
    rules: INITIAL_RULES,
    stockMovements: INITIAL_STOCK_MOVEMENTS,
    orders: INITIAL_ORDERS,
    cart: DEFAULT_POS_CART,
    forecasts: PRODUCT_FORECASTS,
    recommendations: initialRecommendations,
    auditLogs: INITIAL_AUDIT_LOGS,
    lastAnalysisRunAt: '2026-11-12T14:00:00.000Z',
  };
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialPersistedState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (
      !parsed ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.batches) ||
      !Array.isArray(parsed.groupPolicies) ||
      !Array.isArray(parsed.auditLogs)
    ) {
      return createInitialPersistedState();
    }
    return parsed;
  } catch {
    return createInitialPersistedState();
  }
}

function makeAuditEntry(
  prevLogs: AuditLogEntry[],
  actor: User,
  module: AuditLogEntry['module'],
  action: string,
  details: string
): AuditLogEntry {
  const maxId = prevLogs.reduce((m, l) => Math.max(m, l.log_id), 0);
  return {
    log_id: maxId + 1,
    timestamp: new Date().toISOString(),
    actor_name: actor.full_name,
    actor_role: actor.role_name,
    module,
    action,
    details,
  };
}

interface NewProductInput {
  product_name: string;
  sku: string;
  category_name: CategoryName;
  item_type: ProductItemType;
  is_perishable: boolean;
  unit_label: string;
  unit_cost: number;
  selling_price: number;
  sellable_on_pos: boolean;
  supplier: string;
  initial_qty: number;
  batch_number: string;
  expiration_date: string;
  safety_stock: number;
  reorder_level: number;
}

interface CompleteSaleInput {
  discountType: DiscountType;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  ewalletRef?: string;
}

interface AcalenContextValue {
  currentUser: User | null;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  switchDemoRole: (role: RoleName) => void;

  products: Product[];
  batches: InventoryBatch[];
  groupPolicies: GroupRulePolicy[];
  rules: BusinessRule[];
  stockMovements: StockMovement[];
  orders: SalesOrder[];
  cart: CartItem[];
  forecasts: ProductForecastSummary[];
  derivedIngredientForecasts: DerivedIngredientForecast[];
  recommendations: Recommendation[];
  auditLogs: AuditLogEntry[];
  lastAnalysisRunAt: string;
  latestContract: AcalenAnalysisContract;

  todaySalesTotal: number;
  todayOrderCount: number;
  pendingRecommendationCount: number;

  addToCart: (productId: number) => void;
  updateCartQty: (productId: number, quantity: number) => void;
  clearCart: () => void;
  completeSale: (input: CompleteSaleInput) => { ok: boolean; order?: SalesOrder; error?: string };
  processReturnOrVoid: (params: {
    orderId: number;
    mode: 'VOID_ORDER' | 'RETURN_ITEM';
    itemId?: number;
    returnQty?: number;
    reason: string;
  }) => { ok: boolean; error?: string };

  addProduct: (input: NewProductInput) => void;
  editProduct: (
    productId: number,
    updates: Partial<
      Pick<
        Product,
        | 'product_name'
        | 'category_name'
        | 'item_type'
        | 'is_perishable'
        | 'unit_label'
        | 'unit_cost'
        | 'selling_price'
        | 'supplier'
        | 'sellable_on_pos'
        | 'markdown_price'
      >
    >
  ) => void;
  updateProductRecipe: (productId: number, recipe: RecipeIngredient[]) => void;
  recordStockIn: (params: {
    productId: number;
    batchNumber: string;
    qty: number;
    unitCost: number;
    expirationDate: string;
    reason: string;
  }) => void;
  recordStockTransfer: (params: {
    productId: number;
    batchId: number;
    qty: number;
    destination: string;
    reason: string;
  }) => { ok: boolean; error?: string };
  recordWastage: (params: {
    productId: number;
    batchId: number;
    qty: number;
    movementType: Extract<MovementType, 'WASTAGE' | 'SHRINKAGE'>;
    reason: string;
  }) => { ok: boolean; error?: string };

  updateGroupPolicy: (
    categoryName: CategoryName,
    updates: Omit<GroupRulePolicy, 'category_name' | 'item_type' | 'updated_at'>
  ) => void;
  updateBusinessRule: (
    productId: number,
    updates: Partial<
      Pick<
        BusinessRule,
        | 'use_group_default'
        | 'reorder_level'
        | 'safety_stock'
        | 'target_margin_pct'
        | 'expiry_warning_days'
        | 'markdown_pct'
        | 'min_post_markdown_margin_pct'
        | 'enable_stock_rule'
        | 'enable_margin_rule'
        | 'enable_expiry_rule'
        | 'suppress_reorder_on_expiry_surplus'
      >
    >
  ) => void;

  triggerAnalysisRun: (
    triggerSource?: 'manual_dashboard_run' | 'scheduled_hourly_job' | 'rule_update_recheck'
  ) => void;
  updateRecommendationStatus: (recId: number, status: 'APPROVED' | 'DISMISSED') => void;
  applyRecommendationAction: (recId: number) => void;
  resetDemoData: () => void;

  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const AcalenContext = createContext<AcalenContextValue | null>(null);

export const AcalenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(() => loadPersistedState());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota issues
    }
  }, [state]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  const currentUser = useMemo(
    () => USERS.find((u) => u.user_id === state.currentUserId) ?? null,
    [state.currentUserId]
  );

  const setActiveTab = useCallback((tab: NavTab) => {
    setState((prev) => {
      const user = USERS.find((u) => u.user_id === prev.currentUserId);
      if (user?.role_name === 'CASHIER' && tab !== 'pos') {
        return { ...prev, activeTab: 'pos' };
      }
      return { ...prev, activeTab: tab };
    });
  }, []);

  const login = useCallback(
    (username: string, password: string): { ok: boolean; error?: string } => {
      const normalized = username.trim().toLowerCase();
      const matched = USERS.find(
        (u) => u.username.toLowerCase() === normalized && u.password === password
      );
      if (!matched) {
        return {
          ok: false,
          error: 'Invalid username or password. Please verify your credentials and try again.',
        };
      }
      const landingTab: NavTab = matched.role_name === 'CASHIER' ? 'pos' : 'dashboard';
      setState((prev) => ({
        ...prev,
        currentUserId: matched.user_id,
        activeTab: landingTab,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            matched,
            'AUTH',
            'POST /api/auth/login',
            `Authenticated ${matched.role_name} session (${matched.username}).`
          ),
          ...prev.auditLogs,
        ],
      }));
      pushToast({
        type: 'success',
        title: `Signed in as ${matched.full_name}`,
        description:
          matched.role_name === 'MANAGER'
            ? 'Full managerial access enabled.'
            : 'Cashier RBAC active — restricted to POS operations.',
      });
      return { ok: true };
    },
    [pushToast]
  );

  const logout = useCallback(() => {
    setState((prev) => {
      const actor = USERS.find((u) => u.user_id === prev.currentUserId);
      return {
        ...prev,
        currentUserId: null,
        auditLogs: actor
          ? [
              makeAuditEntry(
                prev.auditLogs,
                actor,
                'AUTH',
                'POST /api/auth/logout',
                `Signed out ${actor.role_name} session.`
              ),
              ...prev.auditLogs,
            ]
          : prev.auditLogs,
      };
    });
  }, []);

  const switchDemoRole = useCallback(
    (role: RoleName) => {
      const target = USERS.find((u) => u.role_name === role);
      if (!target) return;
      setState((prev) => ({
        ...prev,
        currentUserId: target.user_id,
        activeTab: role === 'CASHIER' ? 'pos' : 'dashboard',
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            target,
            'AUTH',
            'ROLE_SWITCH',
            `Demo role switched to ${target.role_name} (${target.full_name}).`
          ),
          ...prev.auditLogs,
        ],
      }));
      pushToast({
        type: 'info',
        title: `Switched role to ${role === 'MANAGER' ? 'Manager' : 'Cashier'}`,
        description:
          role === 'CASHIER'
            ? 'Sidebar and cost/analytics modules hidden by RBAC policy.'
            : 'All 6 managerial views unlocked.',
      });
    },
    [pushToast]
  );

  const addToCart = useCallback(
    (productId: number) => {
      const product = state.products.find((p) => p.product_id === productId);
      if (!product) return;
      const available = getProductStock(state.batches, productId);
      const existingQty = state.cart.find((c) => c.product_id === productId)?.quantity ?? 0;

      if (available <= 0) {
        pushToast({
          type: 'error',
          title: `${product.product_name} is Out of Stock`,
          description: 'No active inventory batch has remaining units.',
        });
        return;
      }

      if (existingQty + 1 > available) {
        pushToast({
          type: 'warning',
          title: 'Stock limit reached',
          description: `Only ${available} ${product.unit_label} of ${product.product_name} available across batches.`,
        });
        return;
      }

      setState((prev) => {
        const exists = prev.cart.some((c) => c.product_id === productId);
        const nextCart = exists
          ? prev.cart.map((c) =>
              c.product_id === productId ? { ...c, quantity: c.quantity + 1 } : c
            )
          : [...prev.cart, { product_id: productId, quantity: 1 }];
        return { ...prev, cart: nextCart };
      });
    },
    [state.products, state.batches, state.cart, pushToast]
  );

  const updateCartQty = useCallback(
    (productId: number, quantity: number) => {
      if (quantity <= 0) {
        setState((prev) => ({
          ...prev,
          cart: prev.cart.filter((c) => c.product_id !== productId),
        }));
        return;
      }
      const product = state.products.find((p) => p.product_id === productId);
      const available = getProductStock(state.batches, productId);
      if (quantity > available) {
        pushToast({
          type: 'warning',
          title: 'Cannot exceed batch stock',
          description: `${product?.product_name ?? 'Item'} has ${available} ${product?.unit_label ?? 'units'} available.`,
        });
        return;
      }
      setState((prev) => ({
        ...prev,
        cart: prev.cart.map((c) =>
          c.product_id === productId ? { ...c, quantity } : c
        ),
      }));
    },
    [state.products, state.batches, pushToast]
  );

  const clearCart = useCallback(() => {
    setState((prev) => ({ ...prev, cart: [] }));
  }, []);

  const completeSale = useCallback(
    ({
      discountType,
      paymentMethod,
      amountTendered,
      ewalletRef,
    }: CompleteSaleInput): { ok: boolean; order?: SalesOrder; error?: string } => {
      if (state.cart.length === 0) {
        return { ok: false, error: 'Cart is empty. Add items before completing the sale.' };
      }

      const totals = calculateOrderTotals(state.cart, state.products, discountType);
      if (paymentMethod === 'CASH' && amountTendered < totals.totalAmount) {
        return {
          ok: false,
          error: `Cash received (${amountTendered.toFixed(2)}) is less than total (${totals.totalAmount.toFixed(2)}).`,
        };
      }

      const nextOrderId =
        state.orders.reduce((max, o) => Math.max(max, o.order_id), 1086) + 1;

      const fefoResult = deductStockFEFO(
        state.batches,
        state.cart,
        state.products,
        nextOrderId
      );

      if (!fefoResult.ok) {
        pushToast({
          type: 'error',
          title: 'Checkout blocked by stock check',
          description: fefoResult.error,
        });
        return { ok: false, error: fefoResult.error };
      }

      const actor = currentUser ?? USERS[1];
      const seqNum = String(nextOrderId - 1000).padStart(4, '0');
      const newOrder: SalesOrder = {
        order_id: nextOrderId,
        receipt_no: `OR-20261112-${seqNum}`,
        user_id: actor.user_id,
        cashier_name: actor.full_name,
        discount_type: discountType,
        subtotal: totals.subtotal,
        vat_exempt_deduction: totals.vatExemptDeduction,
        discount_amount: totals.discountAmount,
        total_amount: totals.totalAmount,
        payment_method: paymentMethod,
        amount_tendered:
          paymentMethod === 'CASH' ? amountTendered : totals.totalAmount,
        change_due:
          paymentMethod === 'CASH'
            ? Number((amountTendered - totals.totalAmount).toFixed(2))
            : 0,
        ewallet_ref: paymentMethod === 'E_WALLET' ? ewalletRef || `EW-${nextOrderId}` : undefined,
        status: 'COMPLETED',
        items: fefoResult.deductedItems,
        ingredient_deductions: fefoResult.ingredientDeductions,
        created_at: new Date().toISOString(),
      };

      const maxMoveId = state.stockMovements.reduce(
        (max, m) => Math.max(max, m.movement_id),
        0
      );

      const saleMovements: StockMovement[] = fefoResult.deductedItems.map(
        (item, idx) => ({
          movement_id: maxMoveId + idx + 1,
          batch_id: item.batch_id,
          batch_number: item.batch_number,
          product_id: item.product_id,
          product_name: item.product_name,
          user_id: actor.user_id,
          user_name: actor.full_name,
          movement_type: 'SALE_OUT',
          quantity: -item.quantity,
          reason: `POS Sale ${newOrder.receipt_no} (FEFO deduction)`,
          created_at: newOrder.created_at,
        })
      );

      const recipeMovements: StockMovement[] = fefoResult.ingredientDeductions.map(
        (ingDed, idx) => ({
          movement_id: maxMoveId + saleMovements.length + idx + 1,
          batch_id: ingDed.batch_id,
          batch_number: ingDed.batch_number,
          product_id: ingDed.product_id,
          product_name: ingDed.product_name,
          user_id: actor.user_id,
          user_name: actor.full_name,
          movement_type: 'RECIPE_DEDUCT',
          quantity: -ingDed.quantity,
          reason: `Micro-ingredient BOM deduction (${newOrder.receipt_no})`,
          created_at: newOrder.created_at,
        })
      );

      const nextRecommendations = runAcalenAnalysis(
        state.products,
        fefoResult.updatedBatches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        batches: fefoResult.updatedBatches,
        orders: [newOrder, ...prev.orders],
        stockMovements: [...recipeMovements, ...saleMovements, ...prev.stockMovements],
        cart: [],
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'POS',
            'POST /api/pos/sales',
            `Recorded ${newOrder.receipt_no} (₱${newOrder.total_amount.toFixed(2)}) · Deducted ${fefoResult.deductedItems.length} menu batch(es) & ${fefoResult.ingredientDeductions.length} micro-ingredient batch(es).`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `Sale recorded (${newOrder.receipt_no})`,
        description: `FEFO menu + ${fefoResult.ingredientDeductions.length} micro-ingredient batch deductions synced.`,
      });

      return { ok: true, order: newOrder };
    },
    [
      state.cart,
      state.products,
      state.batches,
      state.orders,
      state.stockMovements,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const processReturnOrVoid = useCallback(
    ({
      orderId,
      mode,
      itemId,
      returnQty,
      reason,
    }: {
      orderId: number;
      mode: 'VOID_ORDER' | 'RETURN_ITEM';
      itemId?: number;
      returnQty?: number;
      reason: string;
    }): { ok: boolean; error?: string } => {
      const targetOrder = state.orders.find((o) => o.order_id === orderId);
      if (!targetOrder) {
        return { ok: false, error: 'Order not found.' };
      }
      if (targetOrder.status === 'VOIDED') {
        return { ok: false, error: 'Order is already voided.' };
      }

      const actor = currentUser ?? USERS[1];
      const restoreEntries: Array<{
        batch_id: number;
        qty: number;
        product_id: number;
        product_name: string;
        batch_number: string;
      }> = [];

      const updatedItems = targetOrder.items.map((item) => {
        if (mode === 'VOID_ORDER') {
          const remainingReturnable = item.quantity - item.returned_qty;
          if (remainingReturnable > 0) {
            restoreEntries.push({
              batch_id: item.batch_id,
              qty: remainingReturnable,
              product_id: item.product_id,
              product_name: item.product_name,
              batch_number: item.batch_number,
            });
          }
          return { ...item, returned_qty: item.quantity };
        }
        if (item.item_id === itemId) {
          const qtyToReturn = Math.min(
            returnQty ?? 1,
            item.quantity - item.returned_qty
          );
          if (qtyToReturn > 0) {
            restoreEntries.push({
              batch_id: item.batch_id,
              qty: qtyToReturn,
              product_id: item.product_id,
              product_name: item.product_name,
              batch_number: item.batch_number,
            });
          }
          return { ...item, returned_qty: item.returned_qty + qtyToReturn };
        }
        return item;
      });

      if (restoreEntries.length === 0) {
        return { ok: false, error: 'No returnable item quantity selected.' };
      }

      // Restore raw ingredients too on full order void
      const rawRestoreEntries =
        mode === 'VOID_ORDER' && targetOrder.ingredient_deductions
          ? targetOrder.ingredient_deductions.map((d) => ({
              batch_id: d.batch_id,
              qty: d.quantity,
            }))
          : [];

      const nextBatches = restoreStockFromItems(state.batches, [
        ...restoreEntries.map((e) => ({ batch_id: e.batch_id, qty: e.qty })),
        ...rawRestoreEntries,
      ]);

      const allReturned = updatedItems.every((i) => i.returned_qty >= i.quantity);
      const nextStatus: SalesOrder['status'] =
        mode === 'VOID_ORDER' || allReturned ? 'VOIDED' : 'PARTIAL_RETURN';

      const maxMoveId = state.stockMovements.reduce(
        (max, m) => Math.max(max, m.movement_id),
        0
      );
      const returnMovements: StockMovement[] = restoreEntries.map((entry, idx) => ({
        movement_id: maxMoveId + idx + 1,
        batch_id: entry.batch_id,
        batch_number: entry.batch_number,
        product_id: entry.product_id,
        product_name: entry.product_name,
        user_id: actor.user_id,
        user_name: actor.full_name,
        movement_type: 'RETURN_IN',
        quantity: entry.qty,
        reason: `${mode === 'VOID_ORDER' ? 'Order Void' : 'Item Return'} (${targetOrder.receipt_no}): ${reason}`,
        created_at: new Date().toISOString(),
      }));

      const nextRecommendations = runAcalenAnalysis(
        state.products,
        nextBatches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        batches: nextBatches,
        orders: prev.orders.map((o) =>
          o.order_id === orderId ? { ...o, status: nextStatus, items: updatedItems } : o
        ),
        stockMovements: [...returnMovements, ...prev.stockMovements],
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'POS',
            'POST /api/pos/returns',
            `${mode === 'VOID_ORDER' ? 'Voided' : 'Returned item on'} ${targetOrder.receipt_no}: ${reason}`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'info',
        title: mode === 'VOID_ORDER' ? `Order ${targetOrder.receipt_no} voided` : 'Return processed',
        description: `Restored ${restoreEntries.reduce((s, r) => s + r.qty, 0)} unit(s) back to batch inventory.`,
      });

      return { ok: true };
    },
    [
      state.orders,
      state.batches,
      state.stockMovements,
      state.products,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const addProduct = useCallback(
    (input: NewProductInput) => {
      const actor = currentUser ?? USERS[0];
      const nextProductId =
        state.products.reduce((m, p) => Math.max(m, p.product_id), 0) + 1;
      const nextBatchId =
        state.batches.reduce((m, b) => Math.max(m, b.batch_id), 100) + 1;
      const nextRuleId =
        state.rules.reduce((m, r) => Math.max(m, r.rule_id), 0) + 1;
      const maxMoveId = state.stockMovements.reduce(
        (m, x) => Math.max(m, x.movement_id),
        0
      );
      const cat = CATEGORIES.find((c) => c.category_name === input.category_name);
      const groupPolicy = state.groupPolicies.find(
        (g) => g.category_name === input.category_name
      );

      const newProduct: Product = {
        product_id: nextProductId,
        sku: input.sku.trim().toUpperCase(),
        category_id: cat?.category_id ?? 1,
        category_name: input.category_name,
        item_type: input.item_type,
        is_perishable: input.is_perishable,
        history_months: 0, // Demonstrates SIA 1 Limitation #1 (>=6 mos required)
        recipe: input.item_type === 'FINISHED_PRODUCT' ? [] : undefined,
        product_name: input.product_name.trim(),
        unit_label: input.unit_label,
        unit_cost: input.unit_cost,
        selling_price: input.selling_price,
        sellable_on_pos:
          input.item_type === 'FINISHED_PRODUCT' && input.sellable_on_pos,
        supplier: input.supplier.trim() || 'Waxi Direct Supplier',
        image_url:
          input.item_type === 'FINISHED_PRODUCT' && input.sellable_on_pos
            ? './images/ucc-coffee.png'
            : undefined,
        status: 'ACTIVE',
      };

      const newBatch: InventoryBatch = {
        batch_id: nextBatchId,
        product_id: nextProductId,
        batch_number: input.batch_number.trim().toUpperCase(),
        qty_on_hand: input.initial_qty,
        unit_cost: input.unit_cost,
        expiration_date: input.expiration_date,
        received_at: REFERENCE_TODAY,
      };

      const newRule: BusinessRule = {
        rule_id: nextRuleId,
        product_id: nextProductId,
        use_group_default: true,
        reorder_level: input.reorder_level,
        safety_stock: input.safety_stock,
        target_margin_pct: groupPolicy?.target_margin_pct ?? 35,
        expiry_warning_days: groupPolicy?.expiry_warning_days ?? 7,
        markdown_pct:
          input.item_type === 'FINISHED_PRODUCT' && input.is_perishable
            ? groupPolicy?.markdown_pct ?? 20
            : 0,
        min_post_markdown_margin_pct: groupPolicy?.min_post_markdown_margin_pct ?? 35,
        enable_stock_rule: true,
        enable_margin_rule: input.item_type === 'FINISHED_PRODUCT',
        enable_expiry_rule: input.is_perishable,
        suppress_reorder_on_expiry_surplus: true,
        updated_at: new Date().toISOString(),
      };

      const newMovement: StockMovement = {
        movement_id: maxMoveId + 1,
        batch_id: nextBatchId,
        batch_number: newBatch.batch_number,
        product_id: nextProductId,
        product_name: newProduct.product_name,
        user_id: actor.user_id,
        user_name: actor.full_name,
        movement_type: 'STOCK_IN',
        quantity: input.initial_qty,
        reason: 'Initial product & batch creation',
        created_at: new Date().toISOString(),
      };

      const nextProducts = [newProduct, ...state.products];
      const nextBatches = [...state.batches, newBatch];
      const nextRules = [...state.rules, newRule];
      const nextRecommendations = runAcalenAnalysis(
        nextProducts,
        nextBatches,
        nextRules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        products: nextProducts,
        batches: nextBatches,
        rules: nextRules,
        stockMovements: [newMovement, ...prev.stockMovements],
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'INVENTORY',
            'POST /api/products',
            `Created ${newProduct.item_type} "${newProduct.product_name}" (${newProduct.sku}) inheriting ${newProduct.category_name} Group Policy.`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `Added ${newProduct.product_name}`,
        description: `${input.initial_qty} ${input.unit_label} logged under ${newBatch.batch_number}.`,
      });
    },
    [
      state.products,
      state.batches,
      state.rules,
      state.stockMovements,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const editProduct = useCallback(
    (
      productId: number,
      updates: Partial<
        Pick<
          Product,
          | 'product_name'
          | 'category_name'
          | 'item_type'
          | 'is_perishable'
          | 'unit_label'
          | 'unit_cost'
          | 'selling_price'
          | 'supplier'
          | 'sellable_on_pos'
          | 'markdown_price'
        >
      >
    ) => {
      const actor = currentUser ?? USERS[0];
      const cat = updates.category_name
        ? CATEGORIES.find((c) => c.category_name === updates.category_name)
        : undefined;

      const nextProducts = state.products.map((p) =>
        p.product_id === productId
          ? {
              ...p,
              ...updates,
              category_id: cat ? cat.category_id : p.category_id,
            }
          : p
      );

      const nextRecommendations = runAcalenAnalysis(
        nextProducts,
        state.batches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      const prodName =
        nextProducts.find((p) => p.product_id === productId)?.product_name ?? 'Product';

      setState((prev) => ({
        ...prev,
        products: nextProducts,
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'INVENTORY',
            'PATCH /api/products',
            `Updated product attributes for ${prodName}.`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: 'Product updated',
        description: 'Catalog changes synced across POS, Inventory, and Decision Support.',
      });
    },
    [
      state.products,
      state.batches,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const updateProductRecipe = useCallback(
    (productId: number, recipe: RecipeIngredient[]) => {
      const actor = currentUser ?? USERS[0];
      const nextProducts = state.products.map((p) =>
        p.product_id === productId ? { ...p, recipe } : p
      );

      const nextRecommendations = runAcalenAnalysis(
        nextProducts,
        state.batches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      const prodName =
        nextProducts.find((p) => p.product_id === productId)?.product_name ?? 'Product';

      setState((prev) => ({
        ...prev,
        products: nextProducts,
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'INVENTORY',
            'UPDATE_RECIPE_BOM',
            `Updated micro-ingredient recipe (${recipe.length} ingredient(s)) for ${prodName}.`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `Recipe BOM updated for ${prodName}`,
        description: 'Derived raw ingredient forecasts & POS deductions recalculated.',
      });
    },
    [
      state.products,
      state.batches,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const recordStockIn = useCallback(
    ({
      productId,
      batchNumber,
      qty,
      unitCost,
      expirationDate,
      reason,
    }: {
      productId: number;
      batchNumber: string;
      qty: number;
      unitCost: number;
      expirationDate: string;
      reason: string;
    }) => {
      const actor = currentUser ?? USERS[0];
      const product = state.products.find((p) => p.product_id === productId);
      if (!product) return;

      const normalizedBatch = batchNumber.trim().toUpperCase();
      const existingBatch = state.batches.find(
        (b) => b.product_id === productId && b.batch_number === normalizedBatch
      );

      let batchIdForMovement: number;
      let nextBatches: InventoryBatch[];

      if (existingBatch) {
        batchIdForMovement = existingBatch.batch_id;
        nextBatches = state.batches.map((b) =>
          b.batch_id === existingBatch.batch_id
            ? {
                ...b,
                qty_on_hand: Math.round((b.qty_on_hand + qty) * 1000) / 1000,
                unit_cost: unitCost,
                expiration_date: expirationDate,
              }
            : b
        );
      } else {
        batchIdForMovement =
          state.batches.reduce((m, b) => Math.max(m, b.batch_id), 100) + 1;
        nextBatches = [
          ...state.batches,
          {
            batch_id: batchIdForMovement,
            product_id: productId,
            batch_number: normalizedBatch,
            qty_on_hand: qty,
            unit_cost: unitCost,
            expiration_date: expirationDate,
            received_at: REFERENCE_TODAY,
          },
        ];
      }

      const maxMoveId = state.stockMovements.reduce(
        (m, x) => Math.max(m, x.movement_id),
        0
      );
      const movement: StockMovement = {
        movement_id: maxMoveId + 1,
        batch_id: batchIdForMovement,
        batch_number: normalizedBatch,
        product_id: productId,
        product_name: product.product_name,
        user_id: actor.user_id,
        user_name: actor.full_name,
        movement_type: 'STOCK_IN',
        quantity: qty,
        reason: reason.trim() || 'Supplier delivery restock',
        created_at: new Date().toISOString(),
      };

      const nextProducts = state.products.map((p) =>
        p.product_id === productId ? { ...p, unit_cost: unitCost } : p
      );

      const nextRecommendations = runAcalenAnalysis(
        nextProducts,
        nextBatches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        products: nextProducts,
        batches: nextBatches,
        stockMovements: [movement, ...prev.stockMovements],
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'INVENTORY',
            'POST /api/inventory/batches',
            `Stock-In +${qty} ${product.unit_label} for ${product.product_name} (${normalizedBatch}).`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `Stock-In recorded (+${qty} ${product.unit_label})`,
        description: `${product.product_name} · ${normalizedBatch} updated.`,
      });
    },
    [
      state.products,
      state.batches,
      state.stockMovements,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const recordStockTransfer = useCallback(
    ({
      productId,
      batchId,
      qty,
      destination,
      reason,
    }: {
      productId: number;
      batchId: number;
      qty: number;
      destination: string;
      reason: string;
    }): { ok: boolean; error?: string } => {
      const actor = currentUser ?? USERS[0];
      const product = state.products.find((p) => p.product_id === productId);
      const batch = state.batches.find((b) => b.batch_id === batchId);
      if (!product || !batch) return { ok: false, error: 'Invalid product or batch.' };
      if (qty > batch.qty_on_hand) {
        return {
          ok: false,
          error: `Transfer quantity (${qty}) exceeds batch balance (${batch.qty_on_hand}).`,
        };
      }

      const nextBatches = state.batches.map((b) =>
        b.batch_id === batchId
          ? { ...b, qty_on_hand: Math.round((b.qty_on_hand - qty) * 1000) / 1000 }
          : b
      );
      const maxMoveId = state.stockMovements.reduce(
        (m, x) => Math.max(m, x.movement_id),
        0
      );
      const movement: StockMovement = {
        movement_id: maxMoveId + 1,
        batch_id: batchId,
        batch_number: batch.batch_number,
        product_id: productId,
        product_name: product.product_name,
        user_id: actor.user_id,
        user_name: actor.full_name,
        movement_type: 'TRANSFER',
        quantity: -qty,
        reason: `Transfer to ${destination}: ${reason}`,
        created_at: new Date().toISOString(),
      };

      const nextRecommendations = runAcalenAnalysis(
        state.products,
        nextBatches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        batches: nextBatches,
        stockMovements: [movement, ...prev.stockMovements],
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'INVENTORY',
            'STOCK_TRANSFER',
            `Transferred ${qty} ${product.unit_label} of ${product.product_name} (${batch.batch_number}) to ${destination}.`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'info',
        title: `Stock transfer logged (-${qty} ${product.unit_label})`,
        description: `${product.product_name} moved to ${destination}.`,
      });
      return { ok: true };
    },
    [
      state.products,
      state.batches,
      state.stockMovements,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const recordWastage = useCallback(
    ({
      productId,
      batchId,
      qty,
      movementType,
      reason,
    }: {
      productId: number;
      batchId: number;
      qty: number;
      movementType: Extract<MovementType, 'WASTAGE' | 'SHRINKAGE'>;
      reason: string;
    }): { ok: boolean; error?: string } => {
      const actor = currentUser ?? USERS[0];
      const product = state.products.find((p) => p.product_id === productId);
      const batch = state.batches.find((b) => b.batch_id === batchId);
      if (!product || !batch) return { ok: false, error: 'Invalid product or batch.' };
      if (qty > batch.qty_on_hand) {
        return {
          ok: false,
          error: `Quantity (${qty}) exceeds batch stock (${batch.qty_on_hand}).`,
        };
      }

      const nextBatches = state.batches.map((b) =>
        b.batch_id === batchId
          ? { ...b, qty_on_hand: Math.round((b.qty_on_hand - qty) * 1000) / 1000 }
          : b
      );
      const maxMoveId = state.stockMovements.reduce(
        (m, x) => Math.max(m, x.movement_id),
        0
      );
      const movement: StockMovement = {
        movement_id: maxMoveId + 1,
        batch_id: batchId,
        batch_number: batch.batch_number,
        product_id: productId,
        product_name: product.product_name,
        user_id: actor.user_id,
        user_name: actor.full_name,
        movement_type: movementType,
        quantity: -qty,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
      };

      const nextRecommendations = runAcalenAnalysis(
        state.products,
        nextBatches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        batches: nextBatches,
        stockMovements: [movement, ...prev.stockMovements],
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'INVENTORY',
            `RECORD_${movementType}`,
            `Recorded ${qty} ${product.unit_label} ${movementType.toLowerCase()} on ${product.product_name} (${batch.batch_number}): ${reason.trim()}.`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'warning',
        title: `${movementType === 'WASTAGE' ? 'Wastage' : 'Audit shrinkage'} recorded`,
        description: `${qty} ${product.unit_label} deducted from ${batch.batch_number}.`,
      });
      return { ok: true };
    },
    [
      state.products,
      state.batches,
      state.stockMovements,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const updateGroupPolicy = useCallback(
    (
      categoryName: CategoryName,
      updates: Omit<GroupRulePolicy, 'category_name' | 'item_type' | 'updated_at'>
    ) => {
      const actor = currentUser ?? USERS[0];
      const nextGroups = state.groupPolicies.map((g) =>
        g.category_name === categoryName
          ? { ...g, ...updates, updated_at: new Date().toISOString() }
          : g
      );

      const nextRecommendations = runAcalenAnalysis(
        state.products,
        state.batches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        nextGroups
      );

      const affectedCount = state.products.filter((p) => {
        if (p.category_name !== categoryName) return false;
        const r = state.rules.find((x) => x.product_id === p.product_id);
        return r?.use_group_default ?? true;
      }).length;

      setState((prev) => ({
        ...prev,
        groupPolicies: nextGroups,
        recommendations: nextRecommendations,
        lastAnalysisRunAt: new Date().toISOString(),
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'RULES',
            'PATCH /api/rules/groups',
            `Updated "${categoryName}" Group Policy (affecting ${affectedCount} inheriting product(s); custom overrides preserved).`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `${categoryName} Group Policy updated`,
        description: `Applied to ${affectedCount} inheriting product(s); custom overrides remained untouched.`,
      });
    },
    [
      state.groupPolicies,
      state.products,
      state.batches,
      state.rules,
      state.forecasts,
      state.recommendations,
      currentUser,
      pushToast,
    ]
  );

  const updateBusinessRule = useCallback(
    (
      productId: number,
      updates: Partial<
        Pick<
          BusinessRule,
          | 'use_group_default'
          | 'reorder_level'
          | 'safety_stock'
          | 'target_margin_pct'
          | 'expiry_warning_days'
          | 'markdown_pct'
          | 'min_post_markdown_margin_pct'
          | 'enable_stock_rule'
          | 'enable_margin_rule'
          | 'enable_expiry_rule'
          | 'suppress_reorder_on_expiry_surplus'
        >
      >
    ) => {
      const actor = currentUser ?? USERS[0];
      const nextRules = state.rules.map((r) =>
        r.product_id === productId
          ? { ...r, ...updates, updated_at: new Date().toISOString() }
          : r
      );

      const nextRecommendations = runAcalenAnalysis(
        state.products,
        state.batches,
        nextRules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      const prod = state.products.find((p) => p.product_id === productId);
      const prodName = prod?.product_name ?? 'Product';
      const modeDesc =
        updates.use_group_default === true
          ? `Reset to inherit ${prod?.category_name ?? 'Group'} Policy`
          : 'Saved Custom Override Policy';

      setState((prev) => ({
        ...prev,
        rules: nextRules,
        recommendations: nextRecommendations,
        lastAnalysisRunAt: new Date().toISOString(),
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'RULES',
            'PATCH /api/rules',
            `${prodName}: ${modeDesc}. Re-evaluated rule engine.`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `Rule updated for ${prodName}`,
        description: `${modeDesc}. Active alerts re-evaluated.`,
      });
    },
    [
      state.rules,
      state.products,
      state.batches,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const triggerAnalysisRun = useCallback(
    (
      triggerSource: 'manual_dashboard_run' | 'scheduled_hourly_job' | 'rule_update_recheck' = 'manual_dashboard_run'
    ) => {
      const actor = currentUser ?? USERS[0];
      const nextRecommendations = runAcalenAnalysis(
        state.products,
        state.batches,
        state.rules,
        state.forecasts,
        state.recommendations,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        recommendations: nextRecommendations,
        lastAnalysisRunAt: new Date().toISOString(),
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'ACALEN_ENGINE',
            'POST /api/acalen/analyze',
            `Trigger: ${triggerSource}. Evaluated ${state.products.length} products (${nextRecommendations.length} active alert(s)).`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: 'Acalen analysis completed',
        description: `Holt-Winters & Chronos-Bolt evaluated ${state.products.length} products; ${nextRecommendations.length} active advisory alert(s).`,
      });
    },
    [
      state.products,
      state.batches,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const updateRecommendationStatus = useCallback(
    (recId: number, status: 'APPROVED' | 'DISMISSED') => {
      const actor = currentUser ?? USERS[0];
      const target = state.recommendations.find((r) => r.recommendation_id === recId);
      setState((prev) => ({
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.recommendation_id === recId ? { ...r, status } : r
        ),
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'ACALEN_ENGINE',
            `ADVISORY_${status}`,
            `${status} advisory "${target?.short_title ?? recId}" for ${target?.product_name ?? 'item'}.`
          ),
          ...prev.auditLogs,
        ],
      }));
      pushToast({
        type: status === 'APPROVED' ? 'success' : 'info',
        title: status === 'APPROVED' ? 'Advisory approved' : 'Advisory dismissed',
        description:
          status === 'APPROVED'
            ? 'Decision logged by manager for execution.'
            : 'Recommendation marked reviewed and dismissed.',
      });
    },
    [state.recommendations, currentUser, pushToast]
  );

  const applyRecommendationAction = useCallback(
    (recId: number) => {
      const actor = currentUser ?? USERS[0];
      const rec = state.recommendations.find((r) => r.recommendation_id === recId);
      if (!rec) return;

      let nextProducts = state.products;
      let nextBatches = state.batches;
      let nextMovements = state.stockMovements;
      let appliedSummary = 'Manager approved advisory.';

      if (rec.suggested_markdown_price) {
        nextProducts = state.products.map((p) =>
          p.product_id === rec.product_id
            ? { ...p, markdown_price: rec.suggested_markdown_price }
            : p
        );
        appliedSummary = `Applied clearance price ₱${rec.suggested_markdown_price} on POS.`;
      } else if (rec.suggested_price && !rec.suggested_reorder_qty) {
        nextProducts = state.products.map((p) =>
          p.product_id === rec.product_id
            ? { ...p, selling_price: rec.suggested_price! }
            : p
        );
        appliedSummary = `Updated selling price to ₱${rec.suggested_price}.`;
      } else if (rec.suggested_reorder_qty) {
        const prod = state.products.find((p) => p.product_id === rec.product_id);
        if (prod) {
          const nextBatchId =
            state.batches.reduce((m, b) => Math.max(m, b.batch_id), 100) + 1;
          const batchNo = `BATCH-${String(nextBatchId).slice(-3)}`;
          nextBatches = [
            ...state.batches,
            {
              batch_id: nextBatchId,
              product_id: prod.product_id,
              batch_number: batchNo,
              qty_on_hand: rec.suggested_reorder_qty,
              unit_cost: prod.unit_cost,
              expiration_date: '2026-12-28',
              received_at: REFERENCE_TODAY,
            },
          ];
          const maxMoveId = state.stockMovements.reduce(
            (m, x) => Math.max(m, x.movement_id),
            0
          );
          nextMovements = [
            {
              movement_id: maxMoveId + 1,
              batch_id: nextBatchId,
              batch_number: batchNo,
              product_id: prod.product_id,
              product_name: prod.product_name,
              user_id: actor.user_id,
              user_name: actor.full_name,
              movement_type: 'STOCK_IN',
              quantity: rec.suggested_reorder_qty,
              reason: `Approved Acalen Reorder Recommendation (#${rec.recommendation_id})`,
              created_at: new Date().toISOString(),
            },
            ...state.stockMovements,
          ];
          appliedSummary = `Received +${rec.suggested_reorder_qty} ${prod.unit_label} (${batchNo}).`;
        }
      }

      const approvedBase = state.recommendations.map((r) =>
        r.recommendation_id === recId ? { ...r, status: 'APPROVED' as const } : r
      );
      const nextRecommendations = runAcalenAnalysis(
        nextProducts,
        nextBatches,
        state.rules,
        state.forecasts,
        approvedBase,
        REFERENCE_TODAY,
        state.groupPolicies
      );

      setState((prev) => ({
        ...prev,
        products: nextProducts,
        batches: nextBatches,
        stockMovements: nextMovements,
        recommendations: nextRecommendations,
        auditLogs: [
          makeAuditEntry(
            prev.auditLogs,
            actor,
            'ACALEN_ENGINE',
            'APPLY_ADVISORY',
            `Applied recommendation for ${rec.product_name}: ${appliedSummary}`
          ),
          ...prev.auditLogs,
        ],
      }));

      pushToast({
        type: 'success',
        title: `Action applied for ${rec.product_name}`,
        description: appliedSummary,
      });
    },
    [
      state.recommendations,
      state.products,
      state.batches,
      state.stockMovements,
      state.rules,
      state.forecasts,
      state.groupPolicies,
      currentUser,
      pushToast,
    ]
  );

  const resetDemoData = useCallback(() => {
    const fresh = createInitialPersistedState();
    setState((prev) => ({
      ...fresh,
      currentUserId: prev.currentUserId,
      activeTab:
        USERS.find((u) => u.user_id === prev.currentUserId)?.role_name === 'CASHIER'
          ? 'pos'
          : 'dashboard',
    }));
    pushToast({
      type: 'info',
      title: 'Demo dataset restored',
      description: 'All inventory batches, BOM recipes, group policies, and alerts reset.',
    });
  }, [pushToast]);

  const derivedIngredientForecasts = useMemo(
    () =>
      calculateDerivedIngredientForecasts(
        state.products,
        state.batches,
        state.forecasts,
        state.rules,
        state.groupPolicies,
        7
      ),
    [state.products, state.batches, state.forecasts, state.rules, state.groupPolicies]
  );

  const { todaySalesTotal, todayOrderCount } = useMemo(() => {
    const liveOrders = state.orders.filter((o) => o.order_id > 1086);
    let netLiveSales = 0;
    let liveCount = 0;

    for (const order of liveOrders) {
      if (order.status === 'VOIDED') continue;
      liveCount += 1;
      const returnedValue = order.items.reduce(
        (sum, item) => sum + item.returned_qty * item.unit_price,
        0
      );
      netLiveSales += Math.max(0, order.total_amount - returnedValue);
    }

    const seededOrders = state.orders.filter((o) => o.order_id <= 1086);
    let baselineAdjustment = 0;
    let voidedSeededCount = 0;
    for (const order of seededOrders) {
      if (order.status === 'VOIDED') {
        baselineAdjustment -= order.total_amount;
        voidedSeededCount += 1;
      } else if (order.status === 'PARTIAL_RETURN') {
        const ret = order.items.reduce(
          (sum, item) => sum + item.returned_qty * item.unit_price,
          0
        );
        baselineAdjustment -= ret;
      }
    }

    return {
      todaySalesTotal: Math.max(
        0,
        Number((BASELINE_TODAY_SALES + netLiveSales + baselineAdjustment).toFixed(2))
      ),
      todayOrderCount: Math.max(0, BASELINE_TODAY_ORDERS + liveCount - voidedSeededCount),
    };
  }, [state.orders]);

  const pendingRecommendationCount = useMemo(
    () => state.recommendations.filter((r) => r.status === 'PENDING').length,
    [state.recommendations]
  );

  const latestContract = useMemo(
    () =>
      buildServiceContractJSON(
        state.products,
        state.batches,
        state.rules,
        state.forecasts,
        state.recommendations,
        'manual_dashboard_run',
        state.groupPolicies
      ),
    [
      state.products,
      state.batches,
      state.rules,
      state.forecasts,
      state.recommendations,
      state.groupPolicies,
    ]
  );

  const value: AcalenContextValue = {
    currentUser,
    activeTab: state.activeTab,
    setActiveTab,
    login,
    logout,
    switchDemoRole,
    products: state.products,
    batches: state.batches,
    groupPolicies: state.groupPolicies,
    rules: state.rules,
    stockMovements: state.stockMovements,
    orders: state.orders,
    cart: state.cart,
    forecasts: state.forecasts,
    derivedIngredientForecasts,
    recommendations: state.recommendations,
    auditLogs: state.auditLogs,
    lastAnalysisRunAt: state.lastAnalysisRunAt,
    latestContract,
    todaySalesTotal,
    todayOrderCount,
    pendingRecommendationCount,
    addToCart,
    updateCartQty,
    clearCart,
    completeSale,
    processReturnOrVoid,
    addProduct,
    editProduct,
    updateProductRecipe,
    recordStockIn,
    recordStockTransfer,
    recordWastage,
    updateGroupPolicy,
    updateBusinessRule,
    triggerAnalysisRun,
    updateRecommendationStatus,
    applyRecommendationAction,
    resetDemoData,
    toasts,
    pushToast,
    dismissToast,
  };

  return <AcalenContext.Provider value={value}>{children}</AcalenContext.Provider>;
};

export function useAcalen(): AcalenContextValue {
  const ctx = useContext(AcalenContext);
  if (!ctx) throw new Error('useAcalen must be used inside AcalenProvider');
  return ctx;
}
