import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ClipboardList, Download, FileText } from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import {
  REFERENCE_TODAY,
  REPORT_PRODUCT_PROFITABILITY,
  REPORT_SALES_HISTORY,
} from '../data/seedData';
import {
  formatPeso,
  getEarliestActiveBatch,
  getExpiryStatus,
  getProductStock,
  resolveEffectiveRule,
} from '../engine/acalenEngine';
import { PriorityPill } from '../components/StatusBadge';
import { AdvisoryReviewModal } from '../components/AdvisoryReviewModal';
import { AuditLogModal } from '../components/AuditLogModal';

export const ReportsPage: React.FC = () => {
  const {
    products,
    batches,
    groupPolicies,
    rules,
    stockMovements,
    orders,
    recommendations,
    todaySalesTotal,
    todayOrderCount,
    triggerAnalysisRun,
    pushToast,
  } = useAcalen();

  const [dateRange, setDateRange] = useState<'7d' | 'today' | '30d'>('7d');
  const [reportType, setReportType] = useState<string>('ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  // Live session wastage added on top of 7-day baseline (18 units / ₱1,260)
  const {
    grossSalesDisplay,
    transactionsDisplay,
    unitsSoldDisplay,
    grossProfitDisplay,
    grossMarginPctDisplay,
    wastageUnits,
    wastageCost,
    stockInTotal,
    stockOutTotal,
    transferIn,
    transferOut,
    shrinkageUnits,
    shrinkageCost,
    expiringBatchCount,
    expiringUnitsTotal,
    profitRows,
  } = useMemo(() => {
    const liveOrders = orders.filter(
      (o) => o.order_id > 1086 && o.status !== 'VOIDED'
    );
    const liveUnits = liveOrders.reduce(
      (s, o) =>
        s + o.items.reduce((is, it) => is + (it.quantity - it.returned_qty), 0),
      0
    );

    const sessionWastageMoves = stockMovements.filter(
      (m) => m.movement_type === 'WASTAGE' && m.movement_id > 5
    );
    const extraWasteUnits = sessionWastageMoves.reduce(
      (s, m) => s + Math.abs(m.quantity),
      0
    );
    const extraWasteCost = sessionWastageMoves.reduce((s, m) => {
      const p = products.find((x) => x.product_id === m.product_id);
      return s + Math.abs(m.quantity) * (p?.unit_cost ?? 0);
    }, 0);

    const sessionStockIn = stockMovements
      .filter((m) => m.movement_type === 'STOCK_IN' && m.movement_id > 5)
      .reduce((s, m) => s + m.quantity, 0);

    const sessionTransferOut = stockMovements
      .filter((m) => m.movement_type === 'TRANSFER' && m.movement_id > 5)
      .reduce((s, m) => s + Math.abs(m.quantity), 0);

    const filteredProf = REPORT_PRODUCT_PROFITABILITY.filter(
      (r) => catFilter === 'ALL' || r.category === catFilter
    );

    const scale =
      dateRange === 'today' ? todaySalesTotal / 85100 : dateRange === '30d' ? 4.12 : 1;

    const grossSales =
      dateRange === 'today'
        ? todaySalesTotal
        : Math.round((85100 + (todaySalesTotal - 12450)) * (dateRange === '30d' ? 4.12 : 1));
    const tx =
      dateRange === 'today'
        ? todayOrderCount
        : Math.round((586 + (todayOrderCount - 86)) * (dateRange === '30d' ? 4.1 : 1));
    const unitsSold =
      dateRange === 'today'
        ? 98 + liveUnits
        : Math.round((610 + liveUnits) * (dateRange === '30d' ? 4.1 : 1));
    const grossProfit = Math.round(grossSales * 0.5954);
    const marginPct = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;

    let expBatches = 0;
    let expUnits = 0;
    for (const p of products) {
      const r = rules.find((x) => x.product_id === p.product_id);
      const eff = resolveEffectiveRule(p, r, groupPolicies);
      const b = getEarliestActiveBatch(batches, p.product_id);
      if (b && b.qty_on_hand > 0) {
        const st = getExpiryStatus(
          b.expiration_date,
          eff.expiry_warning_days,
          REFERENCE_TODAY,
          p.is_perishable
        );
        if (st === 'EXPIRING_SOON' || st === 'EXPIRED') {
          expBatches += 1;
          expUnits += getProductStock(batches, p.product_id);
        }
      }
    }

    return {
      grossSalesDisplay: grossSales,
      transactionsDisplay: tx,
      unitsSoldDisplay: unitsSold,
      grossProfitDisplay: grossProfit,
      grossMarginPctDisplay: marginPct,
      wastageUnits: Math.round(18 * scale) + extraWasteUnits,
      wastageCost: Math.round(1260 * scale) + extraWasteCost,
      stockInTotal: Math.round(840 * scale) + sessionStockIn,
      stockOutTotal: unitsSold,
      transferIn: Math.round(24 * scale),
      transferOut: Math.round(16 * scale) + sessionTransferOut,
      shrinkageUnits: Math.round(6 * scale),
      shrinkageCost: Math.round(420 * scale),
      expiringBatchCount: expBatches,
      expiringUnitsTotal: expUnits,
      profitRows: filteredProf.map((r) => {
        const u = Math.max(1, Math.round(r.units * scale));
        const gp = (r.price - r.unitCost) * u;
        const m = ((r.price - r.unitCost) / r.price) * 100;
        return { ...r, units: u, grossProfit: gp, marginPct: m };
      }),
    };
  }, [
    orders,
    stockMovements,
    products,
    batches,
    groupPolicies,
    rules,
    catFilter,
    dateRange,
    todaySalesTotal,
    todayOrderCount,
  ]);

  const pendingCount = recommendations.filter((r) => r.status === 'PENDING').length;

  const handleGenerateReport = () => {
    triggerAnalysisRun('manual_dashboard_run');
  };

  const handleExportCsv = () => {
    const headers = [
      'Section',
      'Name/Condition',
      'Metric/Evidence',
      'Value/Recommendation',
      'Priority/Margin',
    ];
    const csvRows = [
      headers.join(','),
      `Summary,Gross Sales (${dateRange}),Transactions: ${transactionsDisplay},${grossSalesDisplay},Margin ${grossMarginPctDisplay.toFixed(1)}%`,
      `Summary,Gross Profit,,${grossProfitDisplay},${grossMarginPctDisplay.toFixed(1)}%`,
      `Summary,Recorded Wastage,${wastageUnits} units,${wastageCost},At cost`,
      ...profitRows.map(
        (r) =>
          `Profitability,"${r.product}",${r.units} units @ ₱${r.price},Gross Profit ₱${r.grossProfit},${r.marginPct.toFixed(1)}%`
      ),
      ...recommendations.map(
        (rec) =>
          `Decision Support,"${rec.product_name} (${rec.rule_triggered})","${rec.evidence.replace(/"/g, "'")}","${rec.recommended_action.replace(/"/g, "'")}",${rec.priority}`
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acalen-waxis-cafe-report-${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pushToast({
      type: 'success',
      title: 'CSV report exported',
      description: `Downloaded acalen-waxis-cafe-report-${dateRange}.csv`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter Card matching Figma Image 4 */}
      <div className="acalen-card p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-3">
            <label
              htmlFor="rep-date"
              className="mb-1.5 block text-[11px] font-medium text-[#6B7280]"
            >
              Date range
            </label>
            <select
              id="rep-date"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as '7d' | 'today' | '30d')}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#111827] focus:border-[#1E325C] focus:outline-none"
            >
              <option value="7d">02–08 Nov 2026</option>
              <option value="today">12 Nov 2026 (Current Shift)</option>
              <option value="30d">10 Oct–08 Nov 2026 (30 Days)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="rep-type"
              className="mb-1.5 block text-[11px] font-medium text-[#6B7280]"
            >
              Report type
            </label>
            <select
              id="rep-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#111827] focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All reports</option>
              <option value="SALES">Sales &amp; Profitability</option>
              <option value="INVENTORY">Inventory &amp; Wastage</option>
              <option value="DSS">ACALEN Decision Support</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="rep-cat"
              className="mb-1.5 block text-[11px] font-medium text-[#6B7280]"
            >
              Product / category
            </label>
            <select
              id="rep-cat"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#111827] focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All products &amp; categories</option>
              <option value="Coffee">Coffee</option>
              <option value="Pastries">Pastries</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-3">
            <button
              type="button"
              onClick={handleGenerateReport}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1E325C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#162647]"
            >
              <FileText className="h-3.5 w-3.5" />
              Generate
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-[#F3F4F6]"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => setAuditOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D8E1EE] bg-[#EFF3F9] px-3 py-2 text-xs font-semibold text-[#1E325C] hover:bg-[#E2EAF5]"
              title="View RA 10173 Audit & Activity Log"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Audit
            </button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[#6B7280]">
          Report types: Sales · Product Performance · Inventory · Wastage/Expiry ·
          Profitability · Decision Support
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <p className="text-xs font-medium text-[#6B7280]">Gross sales</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-[#111827] tabular-nums">
              {formatPeso(grossSalesDisplay)}
            </span>
            <span className="text-[11px] text-[#6B7280]">
              {dateRange === 'today' ? 'Shift sales' : dateRange === '30d' ? '30-day sales' : '7-day sales'}
            </span>
          </div>
        </div>

        <div className="acalen-card p-5">
          <p className="text-xs font-medium text-[#6B7280]">Transactions</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-[#111827] tabular-nums">
              {transactionsDisplay}
            </span>
            <span className="text-[11px] text-[#6B7280] tabular-nums">
              {unitsSoldDisplay} units sold
            </span>
          </div>
        </div>

        <div className="acalen-card p-5">
          <p className="text-xs font-medium text-[#6B7280]">Gross profit / margin</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-[#111827] tabular-nums">
              {formatPeso(grossProfitDisplay)}
            </span>
            <span className="text-[11px] font-medium text-[#15803D] tabular-nums">
              {grossMarginPctDisplay.toFixed(1)}% gross margin
            </span>
          </div>
        </div>

        <div className="acalen-card p-5">
          <p className="text-xs font-medium text-[#6B7280]">Recorded wastage</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-[#111827] tabular-nums">
              {formatPeso(wastageCost)}
            </span>
            <span className="text-[11px] text-[#6B7280] tabular-nums">
              {wastageUnits} units · at cost
            </span>
          </div>
        </div>
      </div>

      {/* Middle 2-Column Split: Sales History + Product Profitability */}
      {(reportType === 'ALL' || reportType === 'SALES') && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="acalen-card p-5 xl:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111827]">Sales history</h2>
              <span className="text-[11px] text-[#6B7280]">02–08 Nov</span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E325C]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#1E325C]" />
                Revenue (₱)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#5B7399]" />
                Quantity (units)
              </span>
            </div>

            <div className="mt-3 h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={REPORT_SALES_HISTORY}
                  margin={{ top: 10, right: -10, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#E5E7EB"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 16000]}
                    ticks={[0, 8000, 16000]}
                    tickFormatter={(v: number) => (v === 0 ? '0' : `${v / 1000}k`)}
                    tick={{ fill: '#6B7280', fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 120]}
                    ticks={[0, 60, 120]}
                    tick={{ fill: '#6B7280', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E8ECF2',
                      fontSize: '11px',
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    name="Revenue (₱)"
                    fill="#1E325C"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="quantity"
                    name="Quantity (units)"
                    stroke="#5B7399"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={{ r: 2.5, fill: '#5B7399' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="acalen-card overflow-hidden p-5 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#111827]">
                Product profitability
              </h2>
              <span className="text-[11px] text-[#6B7280]">
                Gross profit = (price − cost) × units
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E8ECF2] text-[11px] font-medium text-[#6B7280]">
                  <tr>
                    <th className="py-2.5 pr-3">Product</th>
                    <th className="px-3 py-2.5 text-right">Units</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                    <th className="px-3 py-2.5 text-right">Unit cost</th>
                    <th className="px-3 py-2.5 text-right">Gross profit</th>
                    <th className="py-2.5 pl-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {profitRows.map((row) => (
                    <tr key={row.product_id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3 pr-3 font-medium text-[#111827]">
                        {row.product}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.units}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatPeso(row.price)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#6B7280] tabular-nums">
                        {formatPeso(row.unitCost)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-[#111827] tabular-nums">
                        {formatPeso(row.grossProfit)}
                      </td>
                      <td className="py-3 pl-3 text-right font-semibold text-[#111827] tabular-nums">
                        {row.marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-[11px] text-[#6B7280]">
              Gross profit excludes operating expenses.
            </p>
          </div>
        </div>
      )}

      {/* Inventory Performance Strip */}
      {(reportType === 'ALL' || reportType === 'INVENTORY') && (
        <div className="acalen-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#111827]">
              Inventory performance
            </h2>
            <span className="text-[11px] text-[#6B7280]">
              Selected period · movements in units
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <span className="text-xs text-[#6B7280]">Stock-in</span>
              <p className="mt-0.5 text-sm font-bold text-[#111827] tabular-nums">
                {stockInTotal}
              </p>
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Sales stock-out</span>
              <p className="mt-0.5 text-sm font-bold text-[#111827] tabular-nums">
                {stockOutTotal}
              </p>
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Transfers</span>
              <p className="mt-0.5 text-sm font-bold text-[#111827] tabular-nums">
                {transferIn} in / {transferOut} out
              </p>
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Wastage</span>
              <p className="mt-0.5 text-sm font-bold text-[#111827] tabular-nums">
                {wastageUnits} · {formatPeso(wastageCost)}
              </p>
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Shrinkage</span>
              <p className="mt-0.5 text-sm font-bold text-[#111827] tabular-nums">
                {shrinkageUnits} · {formatPeso(shrinkageCost)}
              </p>
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Expiring batches</span>
              <p className="mt-0.5 text-sm font-bold text-[#B4690E] tabular-nums">
                {expiringBatchCount} · {expiringUnitsTotal} units
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] px-4 py-2.5 text-xs text-[#4B5563]">
            <strong className="text-[#111827]">Recorded audit discrepancies</strong>{' '}
            &nbsp; 08 Nov · Beans: book 48 / count 44 (−4) · Milk: book 20 / count 18
            (−2) · 6-unit variance recorded as shrinkage.
          </div>
        </div>
      )}

      {/* ACALEN Decision Support Table */}
      {(reportType === 'ALL' || reportType === 'DSS') && (
        <div className="acalen-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
            <h2 className="text-sm font-semibold text-[#111827]">
              ACALEN decision support
            </h2>
            <span className="rounded-md bg-[#EEF2F7] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[#334E7B] uppercase">
              Live Rule Engine Output
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
                <tr>
                  <th className="w-[18%] px-6 py-3">Condition / Product</th>
                  <th className="w-[24%] px-4 py-3">Evidence</th>
                  <th className="w-[22%] px-4 py-3">Applicable Configured Rule</th>
                  <th className="w-[28%] px-4 py-3">Calculated Recommendation</th>
                  <th className="w-[8%] px-6 py-3 text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {recommendations.slice(0, 6).map((rec) => (
                  <tr key={rec.recommendation_id} className="align-top hover:bg-[#F9FAFB]">
                    <td className="px-6 py-4 font-semibold whitespace-pre-line text-[#111827]">
                      {rec.condition_summary}
                    </td>
                    <td className="px-4 py-4 leading-relaxed text-[#4B5563]">
                      {rec.evidence}
                    </td>
                    <td className="px-4 py-4 leading-relaxed text-[#4B5563]">
                      {rec.applicable_rule}
                    </td>
                    <td className="px-4 py-4 leading-relaxed text-[#111827]">
                      {rec.recommended_action}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <PriorityPill priority={rec.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#E8ECF2] bg-[#F9FAFB] px-6 py-2.5 text-[11px] text-[#6B7280]">
            Forecasts are estimates. Recommendations are advisory and subject to manager
            approval.
          </div>
        </div>
      )}

      {/* Manager Review Footer Banner */}
      <div className="acalen-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[#111827]">
            Manager review · {pendingCount} recommendation
            {pendingCount === 1 ? '' : 's'} awaiting review
          </p>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Manager makes the final decision. No automatic price or stock changes;
            forecasts and outcomes are not guaranteed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1E325C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#162647]"
        >
          Review recommendations
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <AdvisoryReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
      <AuditLogModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  );
};
