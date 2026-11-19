import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Pencil,
  Percent,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { CATEGORIES } from '../data/seedData';
import {
  formatPeso,
  getGrossMarginPct,
  getProductStock,
} from '../engine/acalenEngine';
import { RuleCodeBadge } from '../components/StatusBadge';
import { BusinessRule } from '../types/acalen';

export const RulesPage: React.FC = () => {
  const {
    products,
    batches,
    rules,
    recommendations,
    updateBusinessRule,
  } = useAcalen();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    reorder_level: '20',
    safety_stock: '10',
    target_margin_pct: '35',
    expiry_warning_days: '7',
    markdown_pct: '20',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    return products
      .map((product) => {
        const rule = rules.find((r) => r.product_id === product.product_id);
        const stock = getProductStock(batches, product.product_id);
        const margin = getGrossMarginPct(
          product.unit_cost,
          product.markdown_price ?? product.selling_price
        );
        const rec = recommendations.find(
          (r) => r.product_id === product.product_id
        );
        return { product, rule, stock, margin, rec };
      })
      .filter((row) => {
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
  }, [products, rules, batches, recommendations, catFilter, search]);

  const activeAlertsCount = recommendations.filter(
    (r) => r.status === 'PENDING'
  ).length;

  const avgMarginFloor = useMemo(() => {
    if (rules.length === 0) return 30;
    const sum = rules.reduce((s, r) => s + r.target_margin_pct, 0);
    return Math.round(sum / rules.length);
  }, [rules]);

  const openEditor = (productId: number, rule: BusinessRule) => {
    setErrorMsg(null);
    setEditingProductId(productId);
    setEditValues({
      reorder_level: String(rule.reorder_level),
      safety_stock: String(rule.safety_stock),
      target_margin_pct: String(rule.target_margin_pct),
      expiry_warning_days: String(rule.expiry_warning_days),
      markdown_pct: String(rule.markdown_pct),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProductId === null) return;

    const reorder = Number(editValues.reorder_level);
    const safety = Number(editValues.safety_stock);
    const margin = Number(editValues.target_margin_pct);
    const expiryDays = Number(editValues.expiry_warning_days);
    const markdown = Number(editValues.markdown_pct);

    if (
      reorder < 0 ||
      safety < 0 ||
      margin <= 0 ||
      margin >= 95 ||
      expiryDays < 1 ||
      markdown < 0 ||
      markdown >= 80
    ) {
      setErrorMsg(
        'Ensure reorder/safety >= 0, target margin 1–94%, expiry days >= 1, and markdown 0–79%.'
      );
      return;
    }

    updateBusinessRule(editingProductId, {
      reorder_level: reorder,
      safety_stock: safety,
      target_margin_pct: margin,
      expiry_warning_days: expiryDays,
      markdown_pct: markdown,
    });
    setEditingProductId(null);
  };

  const editingProduct = editingProductId
    ? products.find((p) => p.product_id === editingProductId)
    : null;

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Configured Rule Sets
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {rules.length}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">5 rule parameters per product</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Avg Target Margin Floor
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Percent className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {avgMarginFloor}%
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">Minimum default &gt;30% policy</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Expiry Warning Window
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            &le; 7 Days
          </p>
          <p className="mt-1 text-xs font-medium text-[#B4690E]">
            FEFO near-expiry detection
          </p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Active Rule Alerts
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#C53030]">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {activeAlertsCount}
          </p>
          <p className="mt-1 text-xs font-medium text-[#C53030]">
            Pending manager approval
          </p>
        </div>
      </div>

      {/* Deterministic Engine Explainer Strip */}
      <div className="acalen-card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-[#1E325C] p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#1E325C]" />
          <div className="text-xs">
            <p className="font-semibold text-[#111827]">
              No-Code Rule Configuration (SIA 1 Sec. 1.5)
            </p>
            <p className="mt-0.5 text-[#6B7280]">
              Adjusting any product&apos;s reorder level, safety stock, target gross
              margin, expiry warning days, or markdown percentage immediately re-evaluates
              Acalen&apos;s IF-THEN decision layer without altering source code.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or SKU..."
          className="w-full max-w-sm rounded-xl border border-[#E8ECF2] bg-white px-4 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] shadow-xs focus:border-[#1E325C] focus:outline-none"
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          aria-label="Filter rules by category"
          className="rounded-xl border border-[#E8ECF2] bg-white px-3.5 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.category_id} value={c.category_name}>
              {c.category_name}
            </option>
          ))}
        </select>
      </div>

      {/* Rule Thresholds Table */}
      <div className="acalen-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <h2 className="text-base font-semibold text-[#111827]">
            Per-Product Rule Thresholds
          </h2>
          <span className="text-xs text-[#6B7280] tabular-nums">
            {rows.length} configured products
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
              <tr>
                <th className="px-6 py-3.5">Product</th>
                <th className="px-4 py-3.5">Current Stock</th>
                <th className="px-4 py-3.5">Reorder Level</th>
                <th className="px-4 py-3.5">Safety Stock</th>
                <th className="px-4 py-3.5">Margin / Target</th>
                <th className="px-4 py-3.5">Expiry Warn</th>
                <th className="px-4 py-3.5">Markdown %</th>
                <th className="px-4 py-3.5">Rule Evaluation</th>
                <th className="px-6 py-3.5 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {rows.map(({ product, rule, stock, margin, rec }) => {
                if (!rule) return null;
                return (
                  <tr key={product.product_id} className="hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-[#111827]">
                        {product.product_name}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {product.sku} · Cost {formatPeso(product.unit_cost)} / Price{' '}
                        {formatPeso(product.selling_price)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#111827] tabular-nums">
                      {stock} {product.unit_label}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">
                      {rule.reorder_level} {product.unit_label}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">
                      {rule.safety_stock} {product.unit_label}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">
                      <span
                        className={`font-semibold ${
                          product.sellable_on_pos && margin < rule.target_margin_pct
                            ? 'text-[#C53030]'
                            : 'text-[#15803D]'
                        }`}
                      >
                        {margin.toFixed(1)}%
                      </span>{' '}
                      <span className="text-[#9CA3AF]">/ {rule.target_margin_pct}%</span>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">
                      &le; {rule.expiry_warning_days}d
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">{rule.markdown_pct}%</td>
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
                        onClick={() => openEditor(product.product_id, rule)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E325C] hover:bg-[#EFF3F9]"
                      >
                        <Pencil className="h-3 w-3" />
                        Configure
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rule Threshold Modal */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-rule-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 id="edit-rule-title" className="text-base font-semibold text-[#111827]">
                  Configure Rules · {editingProduct.product_name}
                </h2>
                <p className="text-xs text-[#6B7280]">{editingProduct.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProductId(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
              {errorMsg && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {errorMsg}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Reorder Level ({editingProduct.unit_label})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editValues.reorder_level}
                    onChange={(e) =>
                      setEditValues({ ...editValues, reorder_level: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Safety Stock ({editingProduct.unit_label})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editValues.safety_stock}
                    onChange={(e) =>
                      setEditValues({ ...editValues, safety_stock: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Target Margin %
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={94}
                    value={editValues.target_margin_pct}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        target_margin_pct: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Expiry Warn (d)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={editValues.expiry_warning_days}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        expiry_warning_days: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Markdown %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={79}
                    value={editValues.markdown_pct}
                    onChange={(e) =>
                      setEditValues({ ...editValues, markdown_pct: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
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
                  Save &amp; Re-Evaluate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
