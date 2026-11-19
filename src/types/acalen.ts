export type RoleName = 'MANAGER' | 'CASHIER';

export interface Role {
  role_id: number;
  role_name: RoleName;
  description: string;
}

export interface User {
  user_id: number;
  role_id: number;
  role_name: RoleName;
  full_name: string;
  username: string;
  password: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export type CategoryName =
  | 'Coffee'
  | 'Beverages'
  | 'Pastries'
  | 'Food'
  | 'Dairy'
  | 'Baking'
  | 'Supplies';

export interface Category {
  category_id: number;
  category_name: CategoryName;
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type ExpiryStatus = 'GOOD' | 'EXPIRING_SOON' | 'EXPIRED';
export type ProductItemType = 'FINISHED_PRODUCT' | 'RAW_INGREDIENT';

export interface RecipeIngredient {
  ingredient_id: number;
  qty_per_unit: number;
  display_qty: number;
  display_unit: string;
}

export interface Product {
  product_id: number;
  sku: string;
  category_id: number;
  category_name: CategoryName;
  item_type: ProductItemType;
  is_perishable: boolean;
  history_months?: number;
  recipe?: RecipeIngredient[];
  product_name: string;
  unit_label: string; // e.g. 'pcs', 'kg', 'L'
  unit_cost: number;
  selling_price: number;
  sellable_on_pos: boolean;
  supplier: string;
  image_url?: string;
  status: 'ACTIVE' | 'INACTIVE';
  markdown_price?: number;
}

export interface InventoryBatch {
  batch_id: number;
  product_id: number;
  batch_number: string;
  qty_on_hand: number;
  unit_cost: number;
  expiration_date: string; // YYYY-MM-DD
  received_at: string;
}

export type MovementType =
  | 'STOCK_IN'
  | 'SALE_OUT'
  | 'RECIPE_DEDUCT'
  | 'TRANSFER'
  | 'WASTAGE'
  | 'SHRINKAGE'
  | 'RETURN_IN';

export interface StockMovement {
  movement_id: number;
  batch_id: number;
  batch_number: string;
  product_id: number;
  product_name: string;
  user_id: number;
  user_name: string;
  movement_type: MovementType;
  quantity: number;
  reason: string;
  created_at: string;
}

export type DiscountType = 'NONE' | 'SENIOR_CITIZEN' | 'PWD';
export type PaymentMethod = 'CASH' | 'E_WALLET';

export interface SalesOrderItem {
  item_id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  batch_id: number;
  batch_number: string;
  quantity: number;
  returned_qty: number;
  unit_price: number;
}

export interface OrderIngredientDeduction {
  batch_id: number;
  batch_number: string;
  product_id: number;
  product_name: string;
  quantity: number;
  finished_product_id: number;
}

export interface SalesOrder {
  order_id: number;
  receipt_no: string;
  user_id: number;
  cashier_name: string;
  discount_type: DiscountType;
  subtotal: number;
  vat_exempt_deduction: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  amount_tendered: number;
  change_due: number;
  ewallet_ref?: string;
  status: 'COMPLETED' | 'VOIDED' | 'PARTIAL_RETURN';
  items: SalesOrderItem[];
  ingredient_deductions?: OrderIngredientDeduction[];
  created_at: string;
}

export interface GroupRulePolicy {
  category_name: CategoryName;
  item_type: ProductItemType;
  reorder_level: number;
  safety_stock: number;
  target_margin_pct: number;
  expiry_warning_days: number;
  markdown_pct: number;
  min_post_markdown_margin_pct: number;
  enable_stock_rule: boolean;
  enable_margin_rule: boolean;
  enable_expiry_rule: boolean;
  suppress_reorder_on_expiry_surplus: boolean;
  updated_at: string;
}

export interface BusinessRule {
  rule_id: number;
  product_id: number;
  use_group_default: boolean;
  reorder_level: number;
  safety_stock: number;
  target_margin_pct: number;
  expiry_warning_days: number;
  markdown_pct: number;
  min_post_markdown_margin_pct: number;
  enable_stock_rule: boolean;
  enable_margin_rule: boolean;
  enable_expiry_rule: boolean;
  suppress_reorder_on_expiry_surplus: boolean;
  updated_at: string;
}

export interface EffectiveRule {
  source: 'GROUP_DEFAULT' | 'CUSTOM_OVERRIDE';
  group_name: CategoryName;
  reorder_level: number;
  safety_stock: number;
  target_margin_pct: number;
  expiry_warning_days: number;
  markdown_pct: number;
  min_post_markdown_margin_pct: number;
  enable_stock_rule: boolean;
  enable_margin_rule: boolean;
  enable_expiry_rule: boolean;
  suppress_reorder_on_expiry_surplus: boolean;
}

export type ForecastModelType = 'HOLT_WINTERS' | 'CHRONOS_BOLT' | 'ENSEMBLE';

export interface DailyForecastPoint {
  date: string;
  dayLabel: string;
  shortDate: string;
  historicalQty: number;
  holtWintersQty: number;
  chronosBoltQty: number;
  predictedQty: number;
}

export interface ProductForecastSummary {
  product_id: number;
  product_name: string;
  historical_7d: number;
  predicted_7d: number;
  holt_winters_7d: number;
  chronos_bolt_7d: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

export interface DerivedIngredientForecast {
  ingredient_id: number;
  ingredient_name: string;
  sku: string;
  unit_label: string;
  current_stock: number;
  reorder_level: number;
  safety_stock: number;
  derived_7d_usage: number;
  projected_ending_stock: number;
  contributing_products: Array<{
    product_id: number;
    product_name: string;
    finished_7d_qty: number;
    ingredient_usage: number;
  }>;
  status: 'SUFFICIENT' | 'SHORTAGE_RISK';
}

export type RuleTriggeredCode =
  | 'STOCK_SHORTAGE'
  | 'BELOW_TARGET_MARGIN'
  | 'EXPIRY_WARNING';

export type RecommendationCategory =
  | 'Expiry Management'
  | 'Stock Replenishment'
  | 'Waste Reduction'
  | 'Margin Advisory';

export interface Recommendation {
  recommendation_id: number;
  product_id: number;
  product_name: string;
  batch_id?: number;
  batch_number?: string;
  forecast_id: number;
  rule_triggered: RuleTriggeredCode;
  all_rules_triggered: RuleTriggeredCode[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: RecommendationCategory;
  short_title: string;
  short_subtitle: string;
  condition_summary: string;
  evidence: string;
  applicable_rule: string;
  recommended_action: string;
  suggested_reorder_qty?: number;
  suggested_price?: number;
  suggested_markdown_price?: number;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED';
  created_at: string;
}

export interface RuleEvaluationDiagnostic {
  triggeredCodes: RuleTriggeredCode[];
  recommendation: Recommendation | null;
  checks: {
    stockCheckText: string;
    marginCheckText: string;
    expiryCheckText: string;
    precedenceNote: string | null;
  };
}

export interface CartItem {
  product_id: number;
  quantity: number;
}

export interface AcalenAnalysisContract {
  request: {
    trigger_source: 'manual_dashboard_run' | 'scheduled_hourly_job' | 'rule_update_recheck';
    horizon_days: number;
    products: Array<{
      product_id: number;
      item_type: ProductItemType;
      policy_source: 'GROUP_DEFAULT' | 'CUSTOM_OVERRIDE';
      current_stock: number;
      unit_cost: number;
      selling_price: number;
      rules: {
        reorder_level: number;
        safety_stock: number;
        target_margin_pct: number;
        expiry_warning_days: number;
        markdown_pct: number;
        min_post_markdown_margin_pct: number;
      };
      earliest_expiry_date: string;
      daily_sales_history: Array<{ date: string; qty_sold: number }>;
    }>;
  };
  response: {
    status: 'completed';
    executed_at: string;
    models_executed: ['Holt-Winters', 'Chronos-Bolt'];
    metrics: {
      holdout_accuracy_pct: number;
      mape_pct: number;
      rmse: number;
      mae: number;
    };
    results: Array<{
      product_id: number;
      product_name: string;
      predicted_7day_demand: number;
      rules_triggered: RuleTriggeredCode[];
      recommended_action: string;
    }>;
  };
}

export interface AuditLogEntry {
  log_id: number;
  timestamp: string;
  actor_name: string;
  actor_role: RoleName;
  module: 'AUTH' | 'POS' | 'INVENTORY' | 'RULES' | 'ACALEN_ENGINE';
  action: string;
  details: string;
}

export type NavTab =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'rules'
  | 'forecasts'
  | 'reports';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description?: string;
}
