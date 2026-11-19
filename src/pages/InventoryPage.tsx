import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Box,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  Eye,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { CATEGORIES, REFERENCE_TODAY } from '../data/seedData';
import {
  daysBetween,
  convertRecipeQtyToStockUnit,
  formatDateShort,
  formatPeso,
  formatQty,
  formatStockConversion,
  getCompatibleRecipeUnits,
  getEarliestActiveBatch,
  getExpiryStatus,
  getGrossMarginPct,
  getProductBatches,
  getProductStock,
  getStockStatus,
  resolveEffectiveRule,
} from '../engine/acalenEngine';
import { StockStatusPill } from '../components/StatusBadge';
import { CategoryName, Product, ProductItemType, RecipeIngredient } from '../types/acalen';

const PAGE_SIZE = 6;

export const InventoryPage: React.FC = () => {
  const {
    products,
    batches,
    groupPolicies,
    rules,
    stockMovements,
    derivedIngredientForecasts,
    addProduct,
    editProduct,
    updateProductRecipe,
    recordStockIn,
    recordStockTransfer,
    recordWastage,
  } = useAcalen();

  const [itemTypeTab, setItemTypeTab] = useState<'ALL' | ProductItemType>('FINISHED_PRODUCT');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [viewProductId, setViewProductId] = useState<number | null>(null);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<RecipeIngredient[]>([]);
  const [newIngredientId, setNewIngredientId] = useState<string>('1');
  const [newIngredientAmount, setNewIngredientAmount] = useState<string>('18');
  const [newIngredientUnit, setNewIngredientUnit] = useState<string>('g');

  const [editProductTarget, setEditProductTarget] = useState<Product | null>(null);
  const [activeModal, setActiveModal] = useState<
    null | 'add_product' | 'stock_in' | 'transfer' | 'wastage'
  >(null);

  const rawIngredientsList = useMemo(
    () => products.filter((p) => p.item_type === 'RAW_INGREDIENT'),
    [products]
  );

  // Enrich products with effective rules, stock, earliest batch & derived BOM info
  const enriched = useMemo(() => {
    return products.map((product) => {
      const rule = rules.find((r) => r.product_id === product.product_id);
      const eff = resolveEffectiveRule(product, rule, groupPolicies);
      const currentStock = getProductStock(batches, product.product_id);
      const earliestBatch = getEarliestActiveBatch(batches, product.product_id);
      const stockStatus = getStockStatus(currentStock, eff.safety_stock);
      const expiryStatus = getExpiryStatus(
        earliestBatch?.expiration_date,
        eff.expiry_warning_days,
        REFERENCE_TODAY,
        product.is_perishable
      );
      const derivedForecast = derivedIngredientForecasts.find(
        (d) => d.ingredient_id === product.product_id
      );

      return {
        product,
        eff,
        safetyStock: eff.safety_stock,
        currentStock,
        earliestBatch,
        stockStatus,
        expiryStatus,
        derivedForecast,
      };
    });
  }, [products, batches, rules, groupPolicies, derivedIngredientForecasts]);

  const counts = useMemo(() => {
    const finished = enriched.filter((e) => e.product.item_type === 'FINISHED_PRODUCT').length;
    const raw = enriched.filter((e) => e.product.item_type === 'RAW_INGREDIENT').length;
    return { finished, raw, all: enriched.length };
  }, [enriched]);

  const kpis = useMemo(() => {
    const scope =
      itemTypeTab === 'ALL'
        ? enriched
        : enriched.filter((e) => e.product.item_type === itemTypeTab);

    return {
      total: scope.length,
      lowStock: scope.filter((e) => e.stockStatus === 'LOW_STOCK').length,
      expiringSoon: scope.filter(
        (e) =>
          e.currentStock > 0 &&
          (e.expiryStatus === 'EXPIRING_SOON' || e.expiryStatus === 'EXPIRED')
      ).length,
      outOfStock: scope.filter((e) => e.stockStatus === 'OUT_OF_STOCK').length,
    };
  }, [enriched, itemTypeTab]);

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      if (itemTypeTab !== 'ALL' && row.product.item_type !== itemTypeTab) {
        return false;
      }
      if (catFilter !== 'ALL' && row.product.category_name !== catFilter) {
        return false;
      }
      if (stockFilter !== 'ALL' && row.stockStatus !== stockFilter) {
        return false;
      }
      if (expiryFilter !== 'ALL' && row.expiryStatus !== expiryFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          row.product.product_name.toLowerCase().includes(q) ||
          row.product.sku.toLowerCase().includes(q) ||
          (row.earliestBatch?.batch_number.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [enriched, itemTypeTab, catFilter, stockFilter, expiryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Add Product Form State
  const [newForm, setNewForm] = useState({
    product_name: '',
    sku: 'PRD-014',
    category_name: 'Pastries' as CategoryName,
    item_type: 'FINISHED_PRODUCT' as ProductItemType,
    is_perishable: true,
    unit_label: 'pcs',
    unit_cost: '45',
    selling_price: '95',
    sellable_on_pos: true,
    supplier: 'Waxi Kitchen Bakehouse',
    initial_qty: '20',
    batch_number: 'BATCH-050',
    expiration_date: '2026-12-20',
    safety_stock: '10',
    reorder_level: '15',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [stockInForm, setStockInForm] = useState({
    productId: String(products[0]?.product_id ?? 1),
    batchNumber: 'BATCH-051',
    qty: '15',
    unitCost: String(products[0]?.unit_cost ?? 850),
    expirationDate: '2026-12-30',
    reason: 'Supplier delivery restock',
  });

  const [movementForm, setMovementForm] = useState({
    productId: String(products[0]?.product_id ?? 1),
    batchId: '',
    qty: '2',
    destination: 'Main Espresso Bar',
    movementType: 'WASTAGE' as 'WASTAGE' | 'SHRINKAGE',
    reason: 'Expired or damaged stock disposal',
  });

  const [editForm, setEditForm] = useState({
    product_name: '',
    category_name: 'Coffee' as CategoryName,
    item_type: 'FINISHED_PRODUCT' as ProductItemType,
    is_perishable: true,
    unit_label: 'pcs',
    unit_cost: '',
    selling_price: '',
    supplier: '',
    sellable_on_pos: true,
  });

  const openViewModal = (productId: number) => {
    const p = products.find((x) => x.product_id === productId);
    setViewProductId(productId);
    setEditingRecipe(false);
    setRecipeDraft(p?.recipe ? p.recipe.map((r) => ({ ...r })) : []);
    setNewIngredientId('1');
    setNewIngredientAmount('18');
    setNewIngredientUnit('g');
  };

  const openEditModal = (product: Product) => {
    setFormError(null);
    setEditProductTarget(product);
    setEditForm({
      product_name: product.product_name,
      category_name: product.category_name,
      item_type: product.item_type,
      is_perishable: product.is_perishable,
      unit_label: product.unit_label,
      unit_cost: String(product.unit_cost),
      selling_price: String(product.selling_price),
      supplier: product.supplier,
      sellable_on_pos: product.sellable_on_pos,
    });
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(newForm.unit_cost);
    const price = Number(newForm.selling_price);
    const qty = Number(newForm.initial_qty);
    const safety = Number(newForm.safety_stock);
    const reorder = Number(newForm.reorder_level);

    if (!newForm.product_name.trim() || !newForm.sku.trim()) {
      setFormError('Product name and SKU are required.');
      return;
    }
    if (cost <= 0 || price <= 0 || qty < 0 || safety < 0 || reorder < 0) {
      setFormError('Costs, prices, and stock thresholds must be valid positive numbers.');
      return;
    }
    if (!newForm.expiration_date) {
      setFormError('Expiration date is required for batch tracking.');
      return;
    }

    addProduct({
      product_name: newForm.product_name,
      sku: newForm.sku,
      category_name: newForm.category_name,
      item_type: newForm.item_type,
      is_perishable: newForm.is_perishable,
      unit_label: newForm.unit_label,
      unit_cost: cost,
      selling_price: price,
      sellable_on_pos:
        newForm.item_type === 'FINISHED_PRODUCT' && newForm.sellable_on_pos,
      supplier: newForm.supplier,
      initial_qty: qty,
      batch_number: newForm.batch_number,
      expiration_date: newForm.expiration_date,
      safety_stock: safety,
      reorder_level: reorder,
    });
    setFormError(null);
    setActiveModal(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProductTarget) return;
    const cost = Number(editForm.unit_cost);
    const price = Number(editForm.selling_price);
    if (!editForm.product_name.trim()) {
      setFormError('Product name cannot be empty.');
      return;
    }
    if (cost <= 0 || price <= 0) {
      setFormError('Unit cost and selling price must be greater than zero.');
      return;
    }
    editProduct(editProductTarget.product_id, {
      product_name: editForm.product_name.trim(),
      category_name: editForm.category_name,
      item_type: editForm.item_type,
      is_perishable: editForm.is_perishable,
      unit_label: editForm.unit_label,
      unit_cost: cost,
      selling_price: price,
      supplier: editForm.supplier.trim(),
      sellable_on_pos:
        editForm.item_type === 'FINISHED_PRODUCT' && editForm.sellable_on_pos,
    });
    setEditProductTarget(null);
    setFormError(null);
  };

  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(stockInForm.productId);
    const qty = Number(stockInForm.qty);
    const cost = Number(stockInForm.unitCost);
    if (qty <= 0 || cost <= 0 || !stockInForm.batchNumber.trim() || !stockInForm.expirationDate) {
      setFormError('Provide a valid batch number, positive quantity, cost, and expiry date.');
      return;
    }
    recordStockIn({
      productId: pid,
      batchNumber: stockInForm.batchNumber,
      qty,
      unitCost: cost,
      expirationDate: stockInForm.expirationDate,
      reason: stockInForm.reason,
    });
    setFormError(null);
    setActiveModal(null);
  };

  const selectedMovementBatches = useMemo(() => {
    return getProductBatches(batches, Number(movementForm.productId)).filter(
      (b) => b.qty_on_hand > 0
    );
  }, [batches, movementForm.productId]);

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(movementForm.productId);
    const batchId =
      Number(movementForm.batchId) || selectedMovementBatches[0]?.batch_id;
    const qty = Number(movementForm.qty);

    if (!batchId || qty <= 0) {
      setFormError('Select an active batch with available stock and a positive quantity.');
      return;
    }

    const res =
      activeModal === 'transfer'
        ? recordStockTransfer({
            productId: pid,
            batchId,
            qty,
            destination: movementForm.destination,
            reason: movementForm.reason,
          })
        : recordWastage({
            productId: pid,
            batchId,
            qty,
            movementType: movementForm.movementType,
            reason: movementForm.reason,
          });

    if (!res.ok) {
      setFormError(res.error ?? 'Unable to record stock movement.');
      return;
    }
    setFormError(null);
    setActiveModal(null);
  };

  const inspectedProduct = viewProductId
    ? enriched.find((e) => e.product.product_id === viewProductId) ?? null
    : null;

  const selectedNewIngredient = useMemo(
    () =>
      rawIngredientsList.find((r) => r.product_id === Number(newIngredientId)) ??
      rawIngredientsList[0],
    [rawIngredientsList, newIngredientId]
  );

  const compatibleNewUnits = useMemo(
    () =>
      selectedNewIngredient
        ? getCompatibleRecipeUnits(selectedNewIngredient.unit_label)
        : [],
    [selectedNewIngredient]
  );

  const handleSelectNewIngredient = (ingIdStr: string) => {
    setNewIngredientId(ingIdStr);
    const ing = rawIngredientsList.find((r) => r.product_id === Number(ingIdStr));
    if (!ing) return;
    const units = getCompatibleRecipeUnits(ing.unit_label);
    const defaultUnit = units[0]?.unit ?? ing.unit_label;
    setNewIngredientUnit(defaultUnit);
    setNewIngredientAmount(
      defaultUnit === 'g' ? '18' : defaultUnit === 'mL' ? '150' : '1'
    );
  };

  const handleUpdateRecipeLine = (
    ingredientId: number,
    nextDisplayQty: number,
    nextDisplayUnit: string,
    stockUnit: string
  ) => {
    const safeQty = Math.max(0, nextDisplayQty);
    const convertedStockQty = convertRecipeQtyToStockUnit(
      safeQty,
      nextDisplayUnit,
      stockUnit
    );
    setRecipeDraft((prev) =>
      prev.map((line) =>
        line.ingredient_id === ingredientId
          ? {
              ...line,
              display_qty: safeQty,
              display_unit: nextDisplayUnit,
              qty_per_unit: convertedStockQty,
            }
          : line
      )
    );
  };

  const handleAddRecipeIngredient = () => {
    const ing = selectedNewIngredient;
    const displayQty = Number(newIngredientAmount);
    if (!ing || displayQty <= 0) return;

    const unitUsed = newIngredientUnit || compatibleNewUnits[0]?.unit || ing.unit_label;
    const qtyPerUnit = convertRecipeQtyToStockUnit(
      displayQty,
      unitUsed,
      ing.unit_label
    );
    if (qtyPerUnit <= 0) return;

    setRecipeDraft((prev) => {
      const exists = prev.some((x) => x.ingredient_id === ing.product_id);
      if (exists) {
        return prev.map((x) =>
          x.ingredient_id === ing.product_id
            ? {
                ingredient_id: ing.product_id,
                qty_per_unit: qtyPerUnit,
                display_qty: displayQty,
                display_unit: unitUsed,
              }
            : x
        );
      }
      return [
        ...prev,
        {
          ingredient_id: ing.product_id,
          qty_per_unit: qtyPerUnit,
          display_qty: displayQty,
          display_unit: unitUsed,
        },
      ];
    });
  };

  return (
    <div className="space-y-6">
      {/* Item Type Separation Tabs: Finished Menu vs Raw Ingredients */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#E8ECF2] bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setItemTypeTab('FINISHED_PRODUCT');
              setPage(1);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
              itemTypeTab === 'FINISHED_PRODUCT'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            Finished Menu Products ({counts.finished})
          </button>
          <button
            type="button"
            onClick={() => {
              setItemTypeTab('RAW_INGREDIENT');
              setPage(1);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
              itemTypeTab === 'RAW_INGREDIENT'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Raw Ingredients &amp; Supplies ({counts.raw})
          </button>
          <button
            type="button"
            onClick={() => {
              setItemTypeTab('ALL');
              setPage(1);
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold ${
              itemTypeTab === 'ALL'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            All Items ({counts.all})
          </button>
        </div>

        <p className="text-xs text-[#6B7280]">
          {itemTypeTab === 'FINISHED_PRODUCT'
            ? 'Sellable POS menu items linked to micro-ingredient BOM recipes'
            : itemTypeTab === 'RAW_INGREDIENT'
              ? 'Micro-ingredients & packaging tracked via derived menu forecast usage'
              : 'Combined finished goods & raw ingredient inventory'}
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              {itemTypeTab === 'RAW_INGREDIENT'
                ? 'Raw Ingredients & Supplies'
                : itemTypeTab === 'FINISHED_PRODUCT'
                  ? 'Finished Menu Items'
                  : 'Total Products'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.total}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">In selected inventory view</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Low Stock Items</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.lowStock}
          </p>
          <p className="mt-1 text-xs font-medium text-[#B4690E]">Below safety stock</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Expiring Soon</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.expiringSoon}
          </p>
          <p className="mt-1 text-xs font-medium text-[#B4690E]">
            Upcoming batch expirations
          </p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Out of Stock</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#C53030]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.outOfStock}
          </p>
          <p className="mt-1 text-xs font-medium text-[#C53030]">
            Replenishment needed
          </p>
        </div>
      </div>

      {/* Filters & Action Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product name, SKU, or batch..."
              aria-label="Search inventory records"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-4 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] shadow-xs focus:border-[#1E325C] focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.category_id} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by stock status"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={expiryFilter}
              onChange={(e) => {
                setExpiryFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by expiration status"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All Expiration Status</option>
              <option value="GOOD">Normal Shelf Life</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('add_product');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E325C] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#162647]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('stock_in');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8ECF2] bg-white px-4 py-2 text-xs font-semibold text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
          >
            <Download className="h-3.5 w-3.5 text-[#4B5563]" />
            Stock In
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('transfer');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8ECF2] bg-white px-4 py-2 text-xs font-semibold text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#4B5563]" />
            Stock Transfer
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('wastage');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8ECF2] bg-white px-4 py-2 text-xs font-semibold text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
          >
            <Trash2 className="h-3.5 w-3.5 text-[#4B5563]" />
            Record Wastage
          </button>
        </div>
      </div>

      {/* Inventory Records Table */}
      <div className="acalen-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <h2 className="text-base font-semibold text-[#111827]">
            {itemTypeTab === 'FINISHED_PRODUCT'
              ? 'Finished Menu Products'
              : itemTypeTab === 'RAW_INGREDIENT'
                ? 'Raw Ingredients & Supplies'
                : 'All Inventory Records'}
          </h2>
          <span className="text-xs font-medium text-[#6B7280] tabular-nums">
            {filtered.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
              <tr>
                <th className="px-6 py-3.5">Product &amp; Micro-Link</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Current Stock</th>
                <th className="px-4 py-3.5">
                  {itemTypeTab === 'RAW_INGREDIENT' ? 'Derived 7d Usage' : 'Safety Stock'}
                </th>
                <th className="px-4 py-3.5">Unit Cost</th>
                <th className="px-4 py-3.5">Batch/Expiration</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-[#6B7280]">
                    No inventory items match the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows.map(
                  ({
                    product,
                    safetyStock,
                    currentStock,
                    earliestBatch,
                    stockStatus,
                    expiryStatus,
                    derivedForecast,
                  }) => {
                    const stockColor =
                      stockStatus === 'OUT_OF_STOCK'
                        ? 'text-[#C53030]'
                        : stockStatus === 'LOW_STOCK'
                          ? 'text-[#B4690E]'
                          : 'text-[#111827]';
                    const expColor =
                      expiryStatus === 'EXPIRING_SOON' || expiryStatus === 'EXPIRED'
                        ? 'text-[#B4690E]'
                        : 'text-[#6B7280]';

                    const recipeCount = product.recipe?.length ?? 0;

                    return (
                      <tr key={product.product_id} className="hover:bg-[#F9FAFB]">
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#111827]">
                              {product.product_name}
                            </p>
                            {product.item_type === 'FINISHED_PRODUCT' ? (
                              <span className="rounded bg-[#EFF3F9] px-1.5 py-0.5 text-[10px] font-medium text-[#1E325C]">
                                BOM · {recipeCount} ing
                              </span>
                            ) : (
                              <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]">
                                {product.is_perishable ? 'Raw Ingredient' : 'Non-Perishable'}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">
                            {product.sku}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[#4B5563]">
                          {product.category_name}
                        </td>
                        <td
                          className={`px-4 py-4 font-bold tabular-nums ${stockColor}`}
                        >
                          {formatQty(currentStock, product.unit_label)}
                        </td>
                        <td className="px-4 py-4 text-[#6B7280] tabular-nums">
                          {itemTypeTab === 'RAW_INGREDIENT' && derivedForecast ? (
                            <div>
                              <p className="font-semibold text-[#1E325C]">
                                {formatQty(
                                  derivedForecast.derived_7d_usage,
                                  product.unit_label
                                )}{' '}
                                / 7d
                              </p>
                              <p className="text-[10px] text-[#9CA3AF]">
                                Safety {safetyStock} {product.unit_label}
                              </p>
                            </div>
                          ) : (
                            `${safetyStock} ${product.unit_label}`
                          )}
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#111827] tabular-nums">
                          {formatPeso(product.unit_cost, product.unit_cost % 1 !== 0)}
                        </td>
                        <td className="px-4 py-4">
                          {earliestBatch ? (
                            <>
                              <p className="font-mono font-medium text-[#111827]">
                                {earliestBatch.batch_number}
                              </p>
                              <p className={`text-[11px] ${expColor}`}>
                                {product.is_perishable
                                  ? formatDateShort(earliestBatch.expiration_date)
                                  : 'No shelf expiry'}
                              </p>
                            </>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StockStatusPill
                            stockStatus={stockStatus}
                            expiryStatus={expiryStatus}
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openViewModal(product.product_id)}
                              className="inline-flex flex-col items-center gap-0.5 text-[11px] font-medium text-[#4B5563] hover:text-[#1E325C]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="inline-flex flex-col items-center gap-0.5 text-[11px] font-medium text-[#4B5563] hover:text-[#1E325C]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8ECF2] px-6 py-3.5 text-xs text-[#6B7280]">
          <p className="tabular-nums">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}{' '}
            items
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
                  p === safePage
                    ? 'bg-[#1E325C] text-white'
                    : 'border border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F3F4F6]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* View Product, Micro-Ingredients BOM & Batches Modal */}
      {inspectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-product-title"
        >
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="view-product-title"
                    className="text-base font-semibold text-[#111827]"
                  >
                    {inspectedProduct.product.product_name} ({inspectedProduct.product.sku})
                  </h2>
                  <span className="rounded-md bg-[#EFF3F9] px-2 py-0.5 text-[10px] font-semibold text-[#1E325C]">
                    {inspectedProduct.product.item_type === 'FINISHED_PRODUCT'
                      ? 'Finished Menu Item'
                      : 'Raw Ingredient / Supply'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  {inspectedProduct.product.category_name} · Supplier:{' '}
                  {inspectedProduct.product.supplier} · Policy:{' '}
                  {inspectedProduct.eff.source === 'GROUP_DEFAULT'
                    ? `Inherits ${inspectedProduct.eff.group_name} Group`
                    : 'Custom Override'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewProductId(null)}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                aria-label="Close detail modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">Total On Hand</p>
                  <p className="mt-0.5 text-base font-bold text-[#111827] tabular-nums">
                    {formatQty(
                      inspectedProduct.currentStock,
                      inspectedProduct.product.unit_label
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">Unit Cost</p>
                  <p className="mt-0.5 text-base font-bold text-[#111827] tabular-nums">
                    {formatPeso(inspectedProduct.product.unit_cost)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">
                    {inspectedProduct.product.item_type === 'FINISHED_PRODUCT'
                      ? 'Selling Price'
                      : 'Derived 7d Usage'}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-[#111827] tabular-nums">
                    {inspectedProduct.product.item_type === 'FINISHED_PRODUCT'
                      ? formatPeso(
                          inspectedProduct.product.markdown_price ??
                            inspectedProduct.product.selling_price
                        )
                      : formatQty(
                          inspectedProduct.derivedForecast?.derived_7d_usage ?? 0,
                          inspectedProduct.product.unit_label
                        )}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">
                    {inspectedProduct.product.item_type === 'FINISHED_PRODUCT'
                      ? 'Gross Margin'
                      : 'Safety Stock'}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-[#1E325C] tabular-nums">
                    {inspectedProduct.product.item_type === 'FINISHED_PRODUCT'
                      ? `${getGrossMarginPct(
                          inspectedProduct.product.unit_cost,
                          inspectedProduct.product.markdown_price ??
                            inspectedProduct.product.selling_price
                        ).toFixed(1)}%`
                      : formatQty(
                          inspectedProduct.safetyStock,
                          inspectedProduct.product.unit_label
                        )}
                  </p>
                </div>
              </div>

              {/* Micro-Ingredients BOM Section for Finished Products */}
              {inspectedProduct.product.item_type === 'FINISHED_PRODUCT' && (
                <div className="rounded-xl border border-[#E8ECF2] bg-[#F9FAFB] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-[#111827] uppercase">
                        Micro-Ingredients Recipe (Bill of Materials)
                      </h3>
                      <p className="text-[11px] text-[#6B7280]">
                        Deducted FEFO on every POS sale and exploded into raw ingredient demand forecasts
                      </p>
                    </div>
                    {!editingRecipe ? (
                      <button
                        type="button"
                        onClick={() => setEditingRecipe(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D8E1EE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1E325C] hover:bg-[#EFF3F9]"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit Recipe
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecipe(false);
                            setRecipeDraft(
                              inspectedProduct.product.recipe?.map((r) => ({ ...r })) ?? []
                            );
                          }}
                          className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5563]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateProductRecipe(
                              inspectedProduct.product.product_id,
                              recipeDraft
                            );
                            setEditingRecipe(false);
                          }}
                          className="rounded-lg bg-[#1E325C] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#162647]"
                        >
                          Save BOM
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 overflow-hidden rounded-lg border border-[#E8ECF2] bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[11px] font-medium text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2">Raw Ingredient</th>
                          <th className="px-3 py-2">Per 1 Unit Sold</th>
                          <th className="px-3 py-2">Raw Stock On Hand</th>
                          <th className="px-3 py-2 text-right">Max Servings</th>
                          {editingRecipe && <th className="px-3 py-2 text-right">Remove</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {(editingRecipe
                          ? recipeDraft
                          : inspectedProduct.product.recipe ?? []
                        ).map((line) => {
                          const ing = products.find(
                            (p) => p.product_id === line.ingredient_id
                          );
                          if (!ing) return null;
                          const rawAvail = getProductStock(batches, ing.product_id);
                          const maxServings =
                            line.qty_per_unit > 0
                              ? Math.floor(rawAvail / line.qty_per_unit)
                              : 0;
                          return (
                            <tr key={line.ingredient_id}>
                              <td className="px-3 py-2 font-semibold text-[#111827]">
                                {ing.product_name}{' '}
                                <span className="font-mono text-[10px] text-[#9CA3AF]">
                                  ({ing.sku})
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium text-[#1E325C] tabular-nums">
                                {editingRecipe ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="any"
                                      aria-label={`Amount of ${ing.product_name}`}
                                      value={line.display_qty}
                                      onChange={(e) =>
                                        handleUpdateRecipeLine(
                                          line.ingredient_id,
                                          Number(e.target.value) || 0,
                                          line.display_unit,
                                          ing.unit_label
                                        )
                                      }
                                      className="w-20 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#111827] tabular-nums focus:border-[#1E325C] focus:outline-none"
                                    />
                                    <select
                                      aria-label={`Unit for ${ing.product_name}`}
                                      value={line.display_unit}
                                      onChange={(e) =>
                                        handleUpdateRecipeLine(
                                          line.ingredient_id,
                                          line.display_qty,
                                          e.target.value,
                                          ing.unit_label
                                        )
                                      }
                                      className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-medium text-[#1E325C] focus:border-[#1E325C] focus:outline-none"
                                    >
                                      {getCompatibleRecipeUnits(ing.unit_label).map(
                                        (opt) => (
                                          <option key={opt.unit} value={opt.unit}>
                                            {opt.unit}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </div>
                                ) : (
                                  <>
                                    {line.display_qty} {line.display_unit}{' '}
                                    {line.display_unit !== ing.unit_label && (
                                      <span className="text-[10px] text-[#9CA3AF]">
                                        ({formatStockConversion(line.qty_per_unit, ing.unit_label)})
                                      </span>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                <span
                                  className={
                                    rawAvail <= 0
                                      ? 'font-semibold text-[#C53030]'
                                      : 'text-[#374151]'
                                  }
                                >
                                  {formatQty(rawAvail, ing.unit_label)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {maxServings.toLocaleString()}
                              </td>
                              {editingRecipe && (
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecipeDraft((prev) =>
                                        prev.filter(
                                          (x) => x.ingredient_id !== line.ingredient_id
                                        )
                                      )
                                    }
                                    className="text-[#C53030] hover:underline"
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {(editingRecipe
                          ? recipeDraft
                          : inspectedProduct.product.recipe ?? []
                        ).length === 0 && (
                          <tr>
                            <td
                              colSpan={editingRecipe ? 5 : 4}
                              className="px-3 py-4 text-center text-[#9CA3AF]"
                            >
                              No micro-ingredients linked yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {editingRecipe && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[180px] flex-1">
                          <label className="mb-1 block text-[10px] font-medium text-[#6B7280]">
                            Add / Update Ingredient
                          </label>
                          <select
                            value={newIngredientId}
                            onChange={(e) => handleSelectNewIngredient(e.target.value)}
                            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs"
                          >
                            {rawIngredientsList.map((raw) => (
                              <option key={raw.product_id} value={raw.product_id}>
                                {raw.product_name} (stock: {raw.unit_label})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="mb-1 block text-[10px] font-medium text-[#6B7280]">
                            Amount
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            aria-label="New ingredient amount"
                            value={newIngredientAmount}
                            onChange={(e) => setNewIngredientAmount(e.target.value)}
                            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                        <div className="w-36">
                          <label className="mb-1 block text-[10px] font-medium text-[#6B7280]">
                            Unit
                          </label>
                          <select
                            aria-label="New ingredient unit"
                            value={newIngredientUnit}
                            onChange={(e) => setNewIngredientUnit(e.target.value)}
                            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs"
                          >
                            {compatibleNewUnits.map((opt) => (
                              <option key={opt.unit} value={opt.unit}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddRecipeIngredient}
                          className="rounded-lg border border-[#1E325C] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E325C] hover:bg-[#EFF3F9]"
                        >
                          + Add Line
                        </button>
                      </div>
                      {selectedNewIngredient &&
                        Number(newIngredientAmount) > 0 &&
                        newIngredientUnit !== selectedNewIngredient.unit_label && (
                          <p className="text-[11px] text-[#6B7280]">
                            Auto-converts:{' '}
                            <strong className="text-[#1E325C]">
                              {newIngredientAmount} {newIngredientUnit}
                            </strong>{' '}
                            ={' '}
                            <strong className="text-[#111827]">
                              {formatStockConversion(
                                convertRecipeQtyToStockUnit(
                                  Number(newIngredientAmount) || 0,
                                  newIngredientUnit,
                                  selectedNewIngredient.unit_label
                                ),
                                selectedNewIngredient.unit_label
                              )}
                            </strong>{' '}
                            deducted from {selectedNewIngredient.product_name} stock
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}

              {/* Reverse BOM Lookup for Raw Ingredients */}
              {inspectedProduct.product.item_type === 'RAW_INGREDIENT' &&
                inspectedProduct.derivedForecast && (
                  <div className="rounded-xl border border-[#E8ECF2] bg-[#F9FAFB] p-4">
                    <h3 className="text-xs font-semibold text-[#111827] uppercase">
                      Used In Finished Menu Products (Derived 7-Day Forecast)
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">
                      Total expected 7d consumption:{' '}
                      <strong className="text-[#1E325C]">
                        {formatQty(
                          inspectedProduct.derivedForecast.derived_7d_usage,
                          inspectedProduct.product.unit_label
                        )}
                      </strong>{' '}
                      across {inspectedProduct.derivedForecast.contributing_products.length}{' '}
                      menu item(s)
                    </p>
                    <div className="mt-3 overflow-hidden rounded-lg border border-[#E8ECF2] bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFC] text-[11px] font-medium text-[#6B7280]">
                          <tr>
                            <th className="px-3 py-2">Finished Product</th>
                            <th className="px-3 py-2 text-right">7d Forecast</th>
                            <th className="px-3 py-2 text-right">Raw Usage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {inspectedProduct.derivedForecast.contributing_products.map(
                            (cp) => (
                              <tr key={cp.product_id}>
                                <td className="px-3 py-2 font-semibold text-[#111827]">
                                  {cp.product_name}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {cp.finished_7d_qty} pcs
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-[#1E325C] tabular-nums">
                                  {formatQty(
                                    cp.ingredient_usage,
                                    inspectedProduct.product.unit_label
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                          {inspectedProduct.derivedForecast.contributing_products.length ===
                            0 && (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-3 py-4 text-center text-[#9CA3AF]"
                              >
                                Not yet linked to any finished menu item recipe.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              <div>
                <h3 className="text-xs font-semibold text-[#374151] uppercase">
                  FEFO Batch Breakdown
                </h3>
                <div className="mt-2 overflow-hidden rounded-xl border border-[#E8ECF2]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
                      <tr>
                        <th className="px-4 py-2.5">Batch #</th>
                        <th className="px-4 py-2.5">Qty On Hand</th>
                        <th className="px-4 py-2.5">Received</th>
                        <th className="px-4 py-2.5">Expiration Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {getProductBatches(
                        batches,
                        inspectedProduct.product.product_id
                      ).map((b) => {
                        const dLeft = daysBetween(REFERENCE_TODAY, b.expiration_date);
                        return (
                          <tr key={b.batch_id}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-[#111827]">
                              {b.batch_number}
                            </td>
                            <td className="px-4 py-2.5 font-bold tabular-nums">
                              {formatQty(
                                b.qty_on_hand,
                                inspectedProduct.product.unit_label
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[#6B7280]">
                              {formatDateShort(b.received_at)}
                            </td>
                            <td className="px-4 py-2.5">
                              {inspectedProduct.product.is_perishable ? (
                                <span
                                  className={
                                    dLeft <= 7
                                      ? 'font-medium text-[#B4690E]'
                                      : 'text-[#4B5563]'
                                  }
                                >
                                  {formatDateShort(b.expiration_date)} ({dLeft}d)
                                </span>
                              ) : (
                                <span className="text-[#9CA3AF]">Non-perishable</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#374151] uppercase">
                  Recent Stock Movements
                </h3>
                <div className="mt-2 space-y-2">
                  {stockMovements
                    .filter((m) => m.product_id === inspectedProduct.product.product_id)
                    .slice(0, 6)
                    .map((m) => (
                      <div
                        key={m.movement_id}
                        className="flex items-center justify-between rounded-lg border border-[#E8ECF2] bg-[#F9FAFB] px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-medium text-[#111827]">
                            {m.movement_type} ·{' '}
                            <span className="font-mono text-[11px]">{m.batch_number}</span>
                          </p>
                          <p className="text-[11px] text-[#6B7280]">{m.reason}</p>
                        </div>
                        <span
                          className={`font-bold tabular-nums ${
                            m.quantity >= 0 ? 'text-[#15803D]' : 'text-[#C53030]'
                          }`}
                        >
                          {m.quantity >= 0 ? `+${formatQty(m.quantity)}` : formatQty(m.quantity)}{' '}
                          {inspectedProduct.product.unit_label}
                        </span>
                      </div>
                    ))}
                  {stockMovements.filter(
                    (m) => m.product_id === inspectedProduct.product.product_id
                  ).length === 0 && (
                    <p className="text-xs text-[#9CA3AF]">
                      No recent movements logged for this SKU.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {activeModal === 'add_product' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="add-product-title" className="text-base font-semibold text-[#111827]">
                Add New Product &amp; Initial Batch
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddProductSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Item Classification
                  </label>
                  <select
                    value={newForm.item_type}
                    onChange={(e) => {
                      const nextType = e.target.value as ProductItemType;
                      setNewForm({
                        ...newForm,
                        item_type: nextType,
                        sellable_on_pos: nextType === 'FINISHED_PRODUCT',
                        unit_label: nextType === 'RAW_INGREDIENT' ? 'kg' : 'pcs',
                      });
                    }}
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  >
                    <option value="FINISHED_PRODUCT">Finished Menu Product</option>
                    <option value="RAW_INGREDIENT">Raw Ingredient / Supply</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newForm.is_perishable}
                      onChange={(e) =>
                        setNewForm({ ...newForm, is_perishable: e.target.checked })
                      }
                      className="rounded border-[#D1D5DB]"
                    />
                    <span className="font-medium text-[#374151]">
                      Perishable (Track Expiry Alerts)
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={newForm.product_name}
                    onChange={(e) =>
                      setNewForm({ ...newForm, product_name: e.target.value })
                    }
                    placeholder="e.g. Matcha Latte"
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">SKU</label>
                  <input
                    type="text"
                    value={newForm.sku}
                    onChange={(e) => setNewForm({ ...newForm, sku: e.target.value })}
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Category (Group Policy)
                  </label>
                  <select
                    value={newForm.category_name}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        category_name: e.target.value as CategoryName,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.category_id} value={c.category_name}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newForm.unit_cost}
                    onChange={(e) =>
                      setNewForm({ ...newForm, unit_cost: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newForm.selling_price}
                    onChange={(e) =>
                      setNewForm({ ...newForm, selling_price: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Batch #
                  </label>
                  <input
                    type="text"
                    value={newForm.batch_number}
                    onChange={(e) =>
                      setNewForm({ ...newForm, batch_number: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Initial Qty
                  </label>
                  <input
                    type="number"
                    value={newForm.initial_qty}
                    onChange={(e) =>
                      setNewForm({ ...newForm, initial_qty: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={newForm.expiration_date}
                    onChange={(e) =>
                      setNewForm({ ...newForm, expiration_date: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">Unit</label>
                  <input
                    type="text"
                    value={newForm.unit_label}
                    onChange={(e) =>
                      setNewForm({ ...newForm, unit_label: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Safety Stock
                  </label>
                  <input
                    type="number"
                    value={newForm.safety_stock}
                    onChange={(e) =>
                      setNewForm({ ...newForm, safety_stock: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={newForm.reorder_level}
                    onChange={(e) =>
                      setNewForm({ ...newForm, reorder_level: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-product-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="edit-product-title" className="text-base font-semibold text-[#111827]">
                Edit {editProductTarget.product_name}
              </h2>
              <button
                type="button"
                onClick={() => setEditProductTarget(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Product Name
                </label>
                <input
                  type="text"
                  value={editForm.product_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, product_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.unit_cost}
                    onChange={(e) =>
                      setEditForm({ ...editForm, unit_cost: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.selling_price}
                    onChange={(e) =>
                      setEditForm({ ...editForm, selling_price: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Supplier
                </label>
                <input
                  type="text"
                  value={editForm.supplier}
                  onChange={(e) =>
                    setEditForm({ ...editForm, supplier: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={editForm.is_perishable}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_perishable: e.target.checked })
                  }
                  className="rounded border-[#D1D5DB]"
                />
                <span className="text-[#374151]">Perishable batch item</span>
              </label>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditProductTarget(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In Modal */}
      {activeModal === 'stock_in' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-in-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="stock-in-title" className="text-base font-semibold text-[#111827]">
                Record Stock-In Delivery
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleStockInSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Product
                </label>
                <select
                  value={stockInForm.productId}
                  onChange={(e) => {
                    const p = products.find(
                      (x) => x.product_id === Number(e.target.value)
                    );
                    setStockInForm({
                      ...stockInForm,
                      productId: e.target.value,
                      unitCost: String(p?.unit_cost ?? 50),
                    });
                  }}
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                >
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={stockInForm.batchNumber}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, batchNumber: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Quantity Received
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={stockInForm.qty}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, qty: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={stockInForm.unitCost}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, unitCost: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={stockInForm.expirationDate}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, expirationDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#374151]">Notes</label>
                <input
                  type="text"
                  value={stockInForm.reason}
                  onChange={(e) =>
                    setStockInForm({ ...stockInForm, reason: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Log Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer / Wastage Modal */}
      {(activeModal === 'transfer' || activeModal === 'wastage') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="movement-title" className="text-base font-semibold text-[#111827]">
                {activeModal === 'transfer'
                  ? 'Log Stock Transfer'
                  : 'Record Wastage / Shrinkage'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleMovementSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Product
                </label>
                <select
                  value={movementForm.productId}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    const nextBatches = getProductBatches(batches, pid).filter(
                      (b) => b.qty_on_hand > 0
                    );
                    setMovementForm({
                      ...movementForm,
                      productId: e.target.value,
                      batchId: String(nextBatches[0]?.batch_id ?? ''),
                    });
                  }}
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                >
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({formatQty(getProductStock(batches, p.product_id), p.unit_label)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Active Batch
                  </label>
                  <select
                    value={
                      movementForm.batchId ||
                      String(selectedMovementBatches[0]?.batch_id ?? '')
                    }
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, batchId: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  >
                    {selectedMovementBatches.length === 0 ? (
                      <option value="">No stock in batches</option>
                    ) : (
                      selectedMovementBatches.map((b) => (
                        <option key={b.batch_id} value={b.batch_id}>
                          {b.batch_number} ({formatQty(b.qty_on_hand)} avail)
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={movementForm.qty}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, qty: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>

              {activeModal === 'transfer' ? (
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Destination Area
                  </label>
                  <input
                    type="text"
                    value={movementForm.destination}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, destination: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Loss Type
                  </label>
                  <select
                    value={movementForm.movementType}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        movementType: e.target.value as 'WASTAGE' | 'SHRINKAGE',
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  >
                    <option value="WASTAGE">Wastage / Spoilage</option>
                    <option value="SHRINKAGE">Audit Shrinkage / Variance</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block font-medium text-[#374151]">Reason</label>
                <input
                  type="text"
                  value={movementForm.reason}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, reason: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
