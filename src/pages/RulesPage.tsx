import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Coffee,
  Layers,
  Pencil,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { CATEGORIES, REFERENCE_TODAY } from '../data/seedData';
import {
  evaluateSingleProductRule,
  formatPeso,
  formatQty,
  getGrossMarginPct,
  getProductStock,
  resolveEffectiveRule,
} from '../engine/acalenEngine';
import { RuleCodeBadge } from '../components/StatusBadge';
import {
  EffectiveRule,
  GroupRulePolicy,
  ProductItemType,
} from '../types/acalen';

export const RulesPage: React.FC = () => {
  const {
    products,
    batches,
    groupPolicies,
    rules,
    forecasts,
    derivedIngredientForecasts,
    recommendations,
    updateGroupPolicy,
    updateBusinessRule,
  } = useAcalen();

  const [itemTypeTab, setItemTypeTab] = useState<ProductItemType>('FINISHED_PRODUCT');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');

  // Group Policy Editor Modal
  const [editingGroup, setEditingGroup] = useState<GroupRulePolicy | null>(null);
  const [groupForm, setGroupForm] = useState({
    reorder_level: '20',
    safety_stock: '15',
    target_margin_pct: '55',
    expiry_warning_days: '7',
    markdown_pct: '20',
    min_post_markdown_margin_pct: '35',
    enable_stock_rule: true,
    enable_margin_rule: true,
    enable_expiry_rule: true,
    suppress_reorder_on_expiry_surplus: true,
  });

  // Per-Product Policy Editor Modal (Supports Group Default vs Custom Override + Live IF-THEN Preview)
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [useGroupDefault, setUseGroupDefault] = useState(true);
  const [editValues, setEditValues] = useState({
    reorder_level: '20',
    safety_stock: '10',
    target_margin_pct: '55',
    expiry_warning_days: '7',
    markdown_pct: '20',
    min_post_markdown_margin_pct: '35',
    enable_stock_rule: true,
    enable_margin_rule: true,
    enable_expiry_rule: true,
    suppress_reorder_on_expiry_surplus: true,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enrichedRows = useMemo(() => {
    return products
      .map((product) => {
        const rule = rules.find((r) => r.product_id === product.product_id);
        const eff = resolveEffectiveRule(product, rule, groupPolicies);
        const stock = getProductStock(batches, product.product_id);
        const margin = getGrossMarginPct(
          product.unit_cost,
          product.markdown_price ?? product.selling_price
        );
        const rec = recommendations.find((r) => r.product_id === product.product_id);
        const derived = derivedIngredientForecasts.find(
          (d) => d.ingredient_id === product.product_id
        );
        return { product, rule, eff, stock, margin, rec, derived };
      })
      .filter((row) => {
        if (row.product.item_type !== itemTypeTab) return false;
        if (catFilter !== 'ALL' && row.product.category_name !== catFilter) {
          return false;
        }
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          return (
            row.product.product_name.toLowerCase().includes(q) ||
            row.product.sku.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [
    products,
    rules,
    groupPolicies,
    batches,
    recommendations,
    derivedIngredientForecasts,
    itemTypeTab,
    catFilter,
    search,
  ]);

  const policyStats = useMemo(() => {
    const activeAlerts = recommendations.filter((r) => r.status === 'PENDING').length;
    const inheritingCount = rules.filter((r) => r.use_group_default).length;
    const overrideCount = rules.length - inheritingCount;
    return {
      groupCount: groupPolicies.length,
      inheritingCount,
      overrideCount,
      activeAlerts,
    };
  }, [groupPolicies, rules, recommendations]);

  const openGroupEditor = (policy: GroupRulePolicy) => {
    setErrorMsg(null);
    setEditingGroup(policy);
    setGroupForm({
      reorder_level: String(policy.reorder_level),
      safety_stock: String(policy.safety_stock),
      target_margin_pct: String(policy.target_margin_pct),
      expiry_warning_days: String(policy.expiry_warning_days),
      markdown_pct: String(policy.markdown_pct),
      min_post_markdown_margin_pct: String(policy.min_post_markdown_margin_pct),
      enable_stock_rule: policy.enable_stock_rule,
      enable_margin_rule: policy.enable_margin_rule,
      enable_expiry_rule: policy.enable_expiry_rule,
      suppress_reorder_on_expiry_surplus: policy.suppress_reorder_on_expiry_surplus,
    });
  };

  const handleGroupSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    const reorder = Number(groupForm.reorder_level);
    const safety = Number(groupForm.safety_stock);
    const margin = Number(groupForm.target_margin_pct);
    const expiryDays = Number(groupForm.expiry_warning_days);
    const markdown = Number(groupForm.markdown_pct);
    const minMargin = Number(groupForm.min_post_markdown_margin_pct);

    if (
      reorder < 0 ||
      safety < 0 ||
      margin <= 0 ||
      margin >= 95 ||
      expiryDays < 1 ||
      markdown < 0 ||
      markdown >= 80 ||
      minMargin < 0 ||
      minMargin >= 90
    ) {
      setErrorMsg('Please enter valid non-negative thresholds within bounds.');
      return;
    }

    updateGroupPolicy(editingGroup.category_name, {
      reorder_level: reorder,
      safety_stock: safety,
      target_margin_pct: margin,
      expiry_warning_days: expiryDays,
      markdown_pct: markdown,
      min_post_markdown_margin_pct: minMargin,
      enable_stock_rule: groupForm.enable_stock_rule,
      enable_margin_rule: groupForm.enable_margin_rule,
      enable_expiry_rule: groupForm.enable_expiry_rule,
      suppress_reorder_on_expiry_surplus: groupForm.suppress_reorder_on_expiry_surplus,
    });
    setEditingGroup(null);
  };

  const openProductEditor = (productId: number) => {
    setErrorMsg(null);
    const prod = products.find((p) => p.product_id === productId);
    const rule = rules.find((r) => r.product_id === productId);
    if (!prod || !rule) return;
    const eff = resolveEffectiveRule(prod, rule, groupPolicies);

    setEditingProductId(productId);
    setUseGroupDefault(rule.use_group_default);
    setEditValues({
      reorder_level: String(eff.reorder_level),
      safety_stock: String(eff.safety_stock),
      target_margin_pct: String(eff.target_margin_pct),
      expiry_warning_days: String(eff.expiry_warning_days),
      markdown_pct: String(eff.markdown_pct),
      min_post_markdown_margin_pct: String(eff.min_post_markdown_margin_pct),
      enable_stock_rule: eff.enable_stock_rule,
      enable_margin_rule: eff.enable_margin_rule,
      enable_expiry_rule: eff.enable_expiry_rule,
      suppress_reorder_on_expiry_surplus: eff.suppress_reorder_on_expiry_surplus,
    });
  };

  const editingProduct = editingProductId
    ? products.find((p) => p.product_id === editingProductId) ?? null
    : null;

  const editingGroupPolicyForProduct = editingProduct
    ? groupPolicies.find((g) => g.category_name === editingProduct.category_name) ?? null
    : null;

  const handleToggleGroupInheritance = (inherit: boolean) => {
    setUseGroupDefault(inherit);
    if (inherit && editingGroupPolicyForProduct && editingProduct) {
      const isFin = editingProduct.item_type === 'FINISHED_PRODUCT';
      setEditValues({
        reorder_level: String(editingGroupPolicyForProduct.reorder_level),
        safety_stock: String(editingGroupPolicyForProduct.safety_stock),
        target_margin_pct: String(editingGroupPolicyForProduct.target_margin_pct),
        expiry_warning_days: String(editingGroupPolicyForProduct.expiry_warning_days),
        markdown_pct:
          isFin && editingProduct.is_perishable
            ? String(editingGroupPolicyForProduct.markdown_pct)
            : '0',
        min_post_markdown_margin_pct: String(
          editingGroupPolicyForProduct.min_post_markdown_margin_pct
        ),
        enable_stock_rule: editingGroupPolicyForProduct.enable_stock_rule,
        enable_margin_rule: isFin ? editingGroupPolicyForProduct.enable_margin_rule : false,
        enable_expiry_rule: editingProduct.is_perishable
          ? editingGroupPolicyForProduct.enable_expiry_rule
          : false,
        suppress_reorder_on_expiry_surplus:
          editingGroupPolicyForProduct.suppress_reorder_on_expiry_surplus,
      });
    }
  };

  // Live What-If Diagnostic Preview computed on every keystroke!
  const liveWhatIfDiagnostic = useMemo(() => {
    if (!editingProduct) return null;
    const isFin = editingProduct.item_type === 'FINISHED_PRODUCT';
    const previewRule: EffectiveRule = {
      source: useGroupDefault ? 'GROUP_DEFAULT' : 'CUSTOM_OVERRIDE',
      group_name: editingProduct.category_name,
      reorder_level: Number(editValues.reorder_level) || 0,
      safety_stock: Number(editValues.safety_stock) || 0,
      target_margin_pct: Number(editValues.target_margin_pct) || 0,
      expiry_warning_days: Math.max(1, Number(editValues.expiry_warning_days) || 1),
      markdown_pct:
        isFin && editingProduct.is_perishable
          ? Number(editValues.markdown_pct) || 0
          : 0,
      min_post_markdown_margin_pct:
        Number(editValues.min_post_markdown_margin_pct) || 35,
      enable_stock_rule: editValues.enable_stock_rule,
      enable_margin_rule: isFin ? editValues.enable_margin_rule : false,
      enable_expiry_rule: editingProduct.is_perishable
        ? editValues.enable_expiry_rule
        : false,
      suppress_reorder_on_expiry_surplus:
        editValues.suppress_reorder_on_expiry_surplus,
    };

    const predicted7d = isFin
      ? forecasts.find((f) => f.product_id === editingProduct.product_id)?.predicted_7d ??
        20
      : derivedIngredientForecasts.find(
          (d) => d.ingredient_id === editingProduct.product_id
        )?.derived_7d_usage ?? 10;

    return evaluateSingleProductRule(
      editingProduct,
      batches,
      previewRule,
      predicted7d,
      1,
      undefined,
      REFERENCE_TODAY
    );
  }, [
    editingProduct,
    useGroupDefault,
    editValues,
    forecasts,
    derivedIngredientForecasts,
    batches,
  ]);

  const handleProductSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const reorder = Number(editValues.reorder_level);
    const safety = Number(editValues.safety_stock);
    const margin = Number(editValues.target_margin_pct);
    const expiryDays = Number(editValues.expiry_warning_days);
    const markdown = Number(editValues.markdown_pct);
    const minMargin = Number(editValues.min_post_markdown_margin_pct);

    if (
      reorder < 0 ||
      safety < 0 ||
      margin <= 0 ||
      margin >= 95 ||
      expiryDays < 1 ||
      markdown < 0 ||
      markdown >= 80 ||
      minMargin < 0 ||
      minMargin >= 90
    ) {
      setErrorMsg(
        'Ensure reorder/safety >= 0, target margin 1–94%, expiry days >= 1, and markdown 0–79%.'
      );
      return;
    }

    updateBusinessRule(editingProduct.product_id, {
      use_group_default: useGroupDefault,
      reorder_level: reorder,
      safety_stock: safety,
      target_margin_pct: margin,
      expiry_warning_days: expiryDays,
      markdown_pct: markdown,
      min_post_markdown_margin_pct: minMargin,
      enable_stock_rule: editValues.enable_stock_rule,
      enable_margin_rule: editValues.enable_margin_rule,
      enable_expiry_rule: editValues.enable_expiry_rule,
      suppress_reorder_on_expiry_surplus:
        editValues.suppress_reorder_on_expiry_surplus,
    });
    setEditingProductId(null);
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Category Default Settings
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {policyStats.groupCount}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">Shared rules by item type</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Using Category Settings
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#15803D]">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {policyStats.inheritingCount}
          </p>
          <p className="mt-1 text-xs text-[#15803D]">Updates automatically with group</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              With Custom Settings
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <Pencil className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {policyStats.overrideCount}
          </p>
          <p className="mt-1 text-xs font-medium text-[#B4690E]">
            Uses its own special settings
          </p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Active Alerts
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#C53030]">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {policyStats.activeAlerts}
          </p>
          <p className="mt-1 text-xs font-medium text-[#C53030]">
            Waiting for your review
          </p>
        </div>
      </div>

      {/* Category Default Settings Section */}
      <div className="acalen-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">
              Category Default Settings
            </h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Set rules once for an entire category (like all Beverages or Pastries). If you customize one product, it will follow its own rules instead.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-[#334E7B]">
            <span className="rounded-md bg-[#EEF2F7] px-2.5 py-1 font-medium">
              Tip 1: Don&apos;t buy more while old stock is about to spoil
            </span>
            <span className="rounded-md bg-[#EEF2F7] px-2.5 py-1 font-medium">
              Tip 2: Never discount below your minimum profit %
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {groupPolicies.map((gp) => {
            const members = products.filter(
              (p) => p.category_name === gp.category_name
            );
            const inheriting = members.filter((p) => {
              const r = rules.find((x) => x.product_id === p.product_id);
              return r?.use_group_default ?? true;
            }).length;
            const customCount = members.length - inheriting;

            return (
              <div
                key={gp.category_name}
                className="flex flex-col justify-between rounded-xl border border-[#E8ECF2] bg-[#F9FAFB] p-3.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#111827]">
                      {gp.category_name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        gp.item_type === 'FINISHED_PRODUCT'
                          ? 'bg-[#EFF3F9] text-[#1E325C]'
                          : 'bg-[#E5E7EB] text-[#374151]'
                      }`}
                    >
                      {gp.item_type === 'FINISHED_PRODUCT' ? 'Menu Group' : 'Ingredients'}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[#4B5563]">
                    <span>
                      Restock At: <strong className="text-[#111827]">{gp.reorder_level}</strong>
                    </span>
                    <span>
                      Backup Stock: <strong className="text-[#111827]">{gp.safety_stock}</strong>
                    </span>
                    {gp.enable_margin_rule ? (
                      <span>
                        Profit Goal: <strong className="text-[#111827]">{gp.target_margin_pct}%</strong>
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">Profit Goal: N/A</span>
                    )}
                    {gp.enable_expiry_rule ? (
                      <span>
                        Expiry Alert: <strong className="text-[#111827]">≤{gp.expiry_warning_days}d</strong>
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">Expiry Alert: Off</span>
                    )}
                    {gp.item_type === 'FINISHED_PRODUCT' && (
                      <span className="col-span-2">
                        Clearance Discount:{' '}
                        <strong className="text-[#111827]">{gp.markdown_pct}%</strong>{' '}
                        <span className="text-[#9CA3AF]">
                          (min profit {gp.min_post_markdown_margin_pct}%)
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#E8ECF2] pt-2.5 text-[11px]">
                  <span className="text-[#6B7280] tabular-nums">
                    {inheriting} shared · {customCount} custom
                  </span>
                  <button
                    type="button"
                    onClick={() => openGroupEditor(gp)}
                    className="font-semibold text-[#1E325C] hover:underline"
                  >
                    Edit Group Rules
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Separated Product Rule Policies Tabs + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#E8ECF2] bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setItemTypeTab('FINISHED_PRODUCT')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
              itemTypeTab === 'FINISHED_PRODUCT'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            Finished Products
          </button>
          <button
            type="button"
            onClick={() => setItemTypeTab('RAW_INGREDIENT')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
              itemTypeTab === 'RAW_INGREDIENT'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Raw Ingredients &amp; Supplies
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or SKU..."
            className="w-56 rounded-xl border border-[#E8ECF2] bg-white px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] shadow-xs focus:border-[#1E325C] focus:outline-none"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Filter rules by category"
            className="rounded-xl border border-[#E8ECF2] bg-white px-3 py-2 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.category_id} value={c.category_name}>
                {c.category_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Rule Thresholds Table (Tailored columns per Raw vs Finished!) */}
      <div className="acalen-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">
              {itemTypeTab === 'FINISHED_PRODUCT'
                ? 'Finished Menu Items — Alert Rules'
                : 'Raw Ingredients & Supplies — Alert Rules'}
            </h2>
            <p className="text-xs text-[#6B7280]">
              {itemTypeTab === 'FINISHED_PRODUCT'
                ? 'Checks stock levels, profit goals, and when to apply clearance discounts before items spoil'
                : 'Checks weekly ingredient needs from recipes and warns before ingredients spoil'}
            </p>
          </div>
          <span className="text-xs text-[#6B7280] tabular-nums">
            {enrichedRows.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
              <tr>
                <th className="px-6 py-3.5">Product</th>
                <th className="px-4 py-3.5">Rule Applied</th>
                <th className="px-4 py-3.5">Stock / Restock At / Backup</th>
                {itemTypeTab === 'FINISHED_PRODUCT' ? (
                  <>
                    <th className="px-4 py-3.5">Profit / Goal</th>
                    <th className="px-4 py-3.5">Expiry Alert</th>
                    <th className="px-4 py-3.5">Clearance Discount</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3.5">Est. 7-Day Usage</th>
                    <th className="px-4 py-3.5">Expiry Alert</th>
                  </>
                )}
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {enrichedRows.map(({ product, eff, stock, margin, rec, derived }) => (
                <tr key={product.product_id} className="hover:bg-[#F9FAFB]">
                  <td className="px-6 py-3.5">
                    <p className="font-semibold text-[#111827]">{product.product_name}</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {product.sku} · Cost {formatPeso(product.unit_cost)}
                      {itemTypeTab === 'FINISHED_PRODUCT' &&
                        ` / Price ${formatPeso(product.selling_price)}`}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    {eff.source === 'GROUP_DEFAULT' ? (
                      <span className="inline-flex items-center rounded-md bg-[#EEF2F7] px-2 py-0.5 text-[11px] font-medium text-[#334E7B]">
                        Uses {eff.group_name} Rules
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-[#FDE68A] bg-[#FFF8EB] px-2 py-0.5 text-[11px] font-semibold text-[#B4690E]">
                        Own Custom Rules
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums">
                    <span className="font-bold text-[#111827]">
                      {formatQty(stock, product.unit_label)}
                    </span>
                    <span className="block text-[11px] text-[#6B7280]">
                      Restock ≤ {eff.reorder_level} · Backup {eff.safety_stock}
                    </span>
                  </td>

                  {itemTypeTab === 'FINISHED_PRODUCT' ? (
                    <>
                      <td className="px-4 py-3.5 tabular-nums">
                        {eff.enable_margin_rule ? (
                          <>
                            <span
                              className={`font-semibold ${
                                margin < eff.target_margin_pct
                                  ? 'text-[#C53030]'
                                  : 'text-[#15803D]'
                              }`}
                            >
                              {margin.toFixed(1)}%
                            </span>{' '}
                            <span className="text-[#9CA3AF]">
                              / {eff.target_margin_pct}%
                            </span>
                          </>
                        ) : (
                          <span className="text-[#9CA3AF]">Disabled</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {eff.enable_expiry_rule ? `≤ ${eff.expiry_warning_days}d` : 'Off'}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {eff.enable_expiry_rule ? (
                          <span>
                            {eff.markdown_pct}%{' '}
                            <span className="text-[10px] text-[#9CA3AF]">
                              (≥{eff.min_post_markdown_margin_pct}%)
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3.5 tabular-nums">
                        <span className="font-semibold text-[#1E325C]">
                          {formatQty(derived?.derived_7d_usage ?? 0, product.unit_label)}
                        </span>
                        <span className="block text-[10px] text-[#9CA3AF]">
                          {derived?.contributing_products.length ?? 0} linked recipe(s)
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {product.is_perishable && eff.enable_expiry_rule ? (
                          <span className="inline-flex items-center gap-1 text-[#374151]">
                            <Clock className="h-3 w-3 text-[#D97706]" />
                            ≤ {eff.expiry_warning_days}d
                          </span>
                        ) : (
                          <span className="text-[#9CA3AF]">Non-perishable</span>
                        )}
                      </td>
                    </>
                  )}

                  <td className="px-4 py-3.5">
                    {rec ? (
                      <div className="flex flex-wrap gap-1">
                        {rec.all_rules_triggered.map((code) => (
                          <RuleCodeBadge key={code} code={code} />
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-medium text-[#15803D]">
                        <CheckCircle2 className="h-3 w-3" />
                        Healthy
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openProductEditor(product.product_id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E325C] hover:bg-[#EFF3F9]"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit Rules
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Group Policy Editor Modal (Plain-English Labels & Helper Explanations) */}
      {editingGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-group-title"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 id="edit-group-title" className="text-base font-semibold text-[#111827]">
                  Edit Group Rules · {editingGroup.category_name}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Applies to all {editingGroup.category_name} items unless an item has its own custom settings
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGroupSave} className="mt-4 space-y-4 text-xs">
              {errorMsg && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {errorMsg}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-[#111827]">
                    Restock Alert Level
                  </label>
                  <p className="mb-1.5 text-[11px] text-[#6B7280]">
                    Warn me to buy more when stock drops to this number
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={groupForm.reorder_level}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, reorder_level: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111827]">
                    Emergency Backup Stock
                  </label>
                  <p className="mb-1.5 text-[11px] text-[#6B7280]">
                    Extra buffer stock kept so you never run out completely
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={groupForm.safety_stock}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, safety_stock: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-[#111827]">
                    Desired Profit (%)
                  </label>
                  <p className="mb-1.5 text-[11px] text-[#6B7280]">
                    Minimum profit % you want from each sale
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={94}
                    disabled={editingGroup.item_type === 'RAW_INGREDIENT'}
                    value={groupForm.target_margin_pct}
                    onChange={(e) =>
                      setGroupForm({
                        ...groupForm,
                        target_margin_pct: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums disabled:bg-[#F3F4F6] focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111827]">
                    Warn Before Expiry (Days)
                  </label>
                  <p className="mb-1.5 text-[11px] text-[#6B7280]">
                    How many days early to alert you before items spoil
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={groupForm.expiry_warning_days}
                    onChange={(e) =>
                      setGroupForm({
                        ...groupForm,
                        expiry_warning_days: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111827]">
                    Clearance Discount (%)
                  </label>
                  <p className="mb-1.5 text-[11px] text-[#6B7280]">
                    Price-cut % offered to sell items fast before they spoil
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={79}
                    disabled={editingGroup.item_type === 'RAW_INGREDIENT'}
                    value={groupForm.markdown_pct}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, markdown_pct: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums disabled:bg-[#F3F4F6] focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111827]">
                    Lowest Allowed Profit (%)
                  </label>
                  <p className="mb-1.5 text-[11px] text-[#6B7280]">
                    Stop discounting if profit would drop below this %
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={89}
                    disabled={editingGroup.item_type === 'RAW_INGREDIENT'}
                    value={groupForm.min_post_markdown_margin_pct}
                    onChange={(e) =>
                      setGroupForm({
                        ...groupForm,
                        min_post_markdown_margin_pct: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums disabled:bg-[#F3F4F6] focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-[#E8ECF2] bg-[#F9FAFB] p-3.5">
                <p className="text-[11px] font-semibold text-[#374151] uppercase">
                  Alerts Turned On for {editingGroup.category_name}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={groupForm.enable_stock_rule}
                      onChange={(e) =>
                        setGroupForm({
                          ...groupForm,
                          enable_stock_rule: e.target.checked,
                        })
                      }
                    />
                    <span>Warn when running low on stock</span>
                  </label>
                  {editingGroup.item_type === 'FINISHED_PRODUCT' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={groupForm.enable_margin_rule}
                        onChange={(e) =>
                          setGroupForm({
                            ...groupForm,
                            enable_margin_rule: e.target.checked,
                          })
                        }
                      />
                      <span>Warn when profit is too low</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={groupForm.enable_expiry_rule}
                      onChange={(e) =>
                        setGroupForm({
                          ...groupForm,
                          enable_expiry_rule: e.target.checked,
                        })
                      }
                    />
                    <span>Warn before items expire</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={groupForm.suppress_reorder_on_expiry_surplus}
                      onChange={(e) =>
                        setGroupForm({
                          ...groupForm,
                          suppress_reorder_on_expiry_surplus: e.target.checked,
                        })
                      }
                    />
                    <span>Don&apos;t buy more while items are expiring soon</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Save Group Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-Product Policy Editor + Live Check Preview */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-rule-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="edit-rule-title" className="text-base font-semibold text-[#111827]">
                    Edit Rules · {editingProduct.product_name}
                  </h2>
                  <span className="rounded bg-[#EFF3F9] px-2 py-0.5 text-[10px] font-semibold text-[#1E325C]">
                    {editingProduct.item_type === 'FINISHED_PRODUCT'
                      ? 'Menu Item'
                      : 'Raw Ingredient'}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  {editingProduct.sku} · Category: {editingProduct.category_name} · Measured in:{' '}
                  {editingProduct.unit_label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProductId(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleProductSave}
              className="flex-1 space-y-4 overflow-y-auto p-6 text-xs"
            >
              {errorMsg && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {errorMsg}
                </p>
              )}

              {/* Policy Mode Switch */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8ECF2] bg-[#F8FAFC] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleGroupInheritance(true)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      useGroupDefault
                        ? 'bg-[#1E325C] text-white shadow-xs'
                        : 'border border-[#E2E8F0] bg-white text-[#4B5563]'
                    }`}
                  >
                    Follow {editingProduct.category_name} Group Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleGroupInheritance(false)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      !useGroupDefault
                        ? 'bg-[#B4690E] text-white shadow-xs'
                        : 'border border-[#E2E8F0] bg-white text-[#4B5563]'
                    }`}
                  >
                    Use Own Custom Rules
                  </button>
                </div>
                {!useGroupDefault && (
                  <button
                    type="button"
                    onClick={() => handleToggleGroupInheritance(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E325C] hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to Category Rules
                  </button>
                )}
              </div>

              {/* Numeric Threshold Inputs with Layman Explanations */}
              <div
                className={`space-y-3 rounded-xl border p-4 ${
                  useGroupDefault
                    ? 'border-[#E8ECF2] bg-[#F9FAFB]/70'
                    : 'border-[#FDE68A] bg-[#FFFBEB]/40'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#111827]">
                    {useGroupDefault
                      ? `Using ${editingProduct.category_name} Group Rules`
                      : `Custom Rules Only for ${editingProduct.product_name}`}
                  </p>
                  {useGroupDefault && (
                    <span className="text-[11px] text-[#6B7280]">
                      Changing any number switches this item to its own custom rules
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-[#111827]">
                      Restock Alert Level ({editingProduct.unit_label})
                    </label>
                    <p className="mb-1 text-[11px] text-[#6B7280]">
                      Warn me to buy more when stock drops to this number
                    </p>
                    <input
                      type="number"
                      min={0}
                      value={editValues.reorder_level}
                      onChange={(e) => {
                        setUseGroupDefault(false);
                        setEditValues({ ...editValues, reorder_level: e.target.value });
                      }}
                      className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#111827]">
                      Emergency Backup Stock ({editingProduct.unit_label})
                    </label>
                    <p className="mb-1 text-[11px] text-[#6B7280]">
                      Extra buffer stock kept so you never run out
                    </p>
                    <input
                      type="number"
                      min={0}
                      value={editValues.safety_stock}
                      onChange={(e) => {
                        setUseGroupDefault(false);
                        setEditValues({ ...editValues, safety_stock: e.target.value });
                      }}
                      className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {editingProduct.item_type === 'FINISHED_PRODUCT' && (
                    <div>
                      <label className="block font-semibold text-[#111827]">
                        Desired Profit (%)
                      </label>
                      <p className="mb-1 text-[11px] text-[#6B7280]">
                        How much profit you want to earn on each sale
                      </p>
                      <input
                        type="number"
                        min={1}
                        max={94}
                        value={editValues.target_margin_pct}
                        onChange={(e) => {
                          setUseGroupDefault(false);
                          setEditValues({
                            ...editValues,
                            target_margin_pct: e.target.value,
                          });
                        }}
                        className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                      />
                    </div>
                  )}

                  {editingProduct.is_perishable && (
                    <div>
                      <label className="block font-semibold text-[#111827]">
                        Warn Before Expiry (Days)
                      </label>
                      <p className="mb-1 text-[11px] text-[#6B7280]">
                        Days early to alert you before items spoil
                      </p>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={editValues.expiry_warning_days}
                        onChange={(e) => {
                          setUseGroupDefault(false);
                          setEditValues({
                            ...editValues,
                            expiry_warning_days: e.target.value,
                          });
                        }}
                        className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                      />
                    </div>
                  )}

                  {editingProduct.item_type === 'FINISHED_PRODUCT' &&
                    editingProduct.is_perishable && (
                      <>
                        <div>
                          <label className="block font-semibold text-[#111827]">
                            Clearance Discount (%)
                          </label>
                          <p className="mb-1 text-[11px] text-[#6B7280]">
                            Price-cut % offered before items expire
                          </p>
                          <input
                            type="number"
                            min={0}
                            max={79}
                            value={editValues.markdown_pct}
                            onChange={(e) => {
                              setUseGroupDefault(false);
                              setEditValues({
                                ...editValues,
                                markdown_pct: e.target.value,
                              });
                            }}
                            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#111827]">
                            Lowest Allowed Profit (%)
                          </label>
                          <p className="mb-1 text-[11px] text-[#6B7280]">
                            Stop discounting if profit drops below this %
                          </p>
                          <input
                            type="number"
                            min={0}
                            max={89}
                            value={editValues.min_post_markdown_margin_pct}
                            onChange={(e) => {
                              setUseGroupDefault(false);
                              setEditValues({
                                ...editValues,
                                min_post_markdown_margin_pct: e.target.value,
                              });
                            }}
                            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                </div>

                {/* Rule Toggles */}
                <div className="grid grid-cols-1 gap-2 pt-1 text-[11px] text-[#374151] sm:grid-cols-2">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editValues.enable_stock_rule}
                      onChange={(e) => {
                        setUseGroupDefault(false);
                        setEditValues({
                          ...editValues,
                          enable_stock_rule: e.target.checked,
                        });
                      }}
                    />
                    Warn when running low on stock
                  </label>
                  {editingProduct.item_type === 'FINISHED_PRODUCT' && (
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={editValues.enable_margin_rule}
                        onChange={(e) => {
                          setUseGroupDefault(false);
                          setEditValues({
                            ...editValues,
                            enable_margin_rule: e.target.checked,
                          });
                        }}
                      />
                      Warn when profit is too low
                    </label>
                  )}
                  {editingProduct.is_perishable && (
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={editValues.enable_expiry_rule}
                        onChange={(e) => {
                          setUseGroupDefault(false);
                          setEditValues({
                            ...editValues,
                            enable_expiry_rule: e.target.checked,
                          });
                        }}
                      />
                      Warn before items expire
                    </label>
                  )}
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editValues.suppress_reorder_on_expiry_surplus}
                      onChange={(e) => {
                        setUseGroupDefault(false);
                        setEditValues({
                          ...editValues,
                          suppress_reorder_on_expiry_surplus: e.target.checked,
                        });
                      }}
                    />
                    Don&apos;t buy more while items are expiring soon
                  </label>
                </div>
              </div>

              {/* Live Check Preview Box */}
              {liveWhatIfDiagnostic && (
                <div className="rounded-xl border border-[#D8E1EE] bg-[#F4F7FC] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-[#1E325C]">
                      <Sparkles className="h-4 w-4" />
                      <span>Live Check (Before You Save)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {liveWhatIfDiagnostic.triggeredCodes.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                          <CheckCircle2 className="h-3 w-3" />
                          All Good (No Alerts)
                        </span>
                      ) : (
                        liveWhatIfDiagnostic.triggeredCodes.map((c) => (
                          <RuleCodeBadge key={c} code={c} />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-[#334155]">
                    <p>
                      <strong>Stock Check:</strong>{' '}
                      {liveWhatIfDiagnostic.checks.stockCheckText}
                    </p>
                    <p>
                      <strong>Profit Check:</strong>{' '}
                      {liveWhatIfDiagnostic.checks.marginCheckText}
                    </p>
                    <p>
                      <strong>Expiry Check:</strong>{' '}
                      {liveWhatIfDiagnostic.checks.expiryCheckText}
                    </p>
                    {liveWhatIfDiagnostic.checks.precedenceNote && (
                      <p className="rounded bg-[#FFF8EB] px-2 py-1 font-medium text-[#B4690E]">
                        {liveWhatIfDiagnostic.checks.precedenceNote}
                      </p>
                    )}
                    {liveWhatIfDiagnostic.recommendation && (
                      <p className="mt-2 rounded-lg border border-[#D8E1EE] bg-white p-2.5 text-[#111827]">
                        <strong>Suggested Action:</strong>{' '}
                        {liveWhatIfDiagnostic.recommendation.recommended_action}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProductId(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Save &amp; Update Alerts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
