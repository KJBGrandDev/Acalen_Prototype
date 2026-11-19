import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Box,
  Calendar,
  CheckCircle2,
  Coffee,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { CATEGORIES, FORECAST_7DAY_SERIES } from '../data/seedData';
import {
  calculateDerivedIngredientForecasts,
  formatQty,
} from '../engine/acalenEngine';
import { ForecastModelType } from '../types/acalen';

export const ForecastsPage: React.FC = () => {
  const { products, batches, rules, groupPolicies, forecasts } = useAcalen();

  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 30>(7);
  const [modelType, setModelType] = useState<ForecastModelType>('ENSEMBLE');
  const [tableTab, setTableTab] = useState<'finished' | 'raw_bom'>('finished');

  // Scale factor when filtering by category or product
  const {
    seriesData,
    totalExpectedDemand,
    peakDayLabel,
    filteredProductRows,
    insufficientHistoryProducts,
  } = useMemo(() => {
    const baseTotal7d = FORECAST_7DAY_SERIES.reduce(
      (s, d) => s + d.predictedQty,
      0
    );

    const matchingRows = forecasts.filter((f) => {
      const prod = products.find((p) => p.product_id === f.product_id);
      if (!prod) return false;
      if (
        selectedProductId !== 'ALL' &&
        f.product_id !== Number(selectedProductId)
      ) {
        return false;
      }
      if (selectedCategory !== 'ALL' && prod.category_name !== selectedCategory) {
        return false;
      }
      return true;
    });

    const newProductsShortHistory = products.filter(
      (p) =>
        p.item_type === 'FINISHED_PRODUCT' &&
        (p.history_months ?? 9) < 6 &&
        (selectedCategory === 'ALL' || p.category_name === selectedCategory) &&
        (selectedProductId === 'ALL' || p.product_id === Number(selectedProductId))
    );

    const allProductsSum7d = forecasts.reduce((s, f) => s + f.predicted_7d, 0);
    const filteredSum7d = matchingRows.reduce((s, f) => s + f.predicted_7d, 0);

    const scale =
      selectedProductId === 'ALL' && selectedCategory === 'ALL'
        ? 1
        : allProductsSum7d > 0
          ? Math.max(0.02, filteredSum7d / allProductsSum7d)
          : 1;

    const buildPoints = () => {
      if (horizonDays === 7) {
        return FORECAST_7DAY_SERIES.map((pt) => {
          const rawForecast =
            modelType === 'HOLT_WINTERS'
              ? pt.holtWintersQty
              : modelType === 'CHRONOS_BOLT'
                ? pt.chronosBoltQty
                : pt.predictedQty;

          return {
            ...pt,
            historical: Math.round(pt.historicalQty * scale),
            forecast: Math.round(rawForecast * scale),
          };
        });
      }

      const totalDays = horizonDays;
      const points = [];
      for (let i = 0; i < totalDays; i++) {
        const basePt = FORECAST_7DAY_SERIES[i % 7];
        const weekIndex = Math.floor(i / 7);
        const growthBoost = 1 + weekIndex * 0.03;
        const dateObj = new Date('2026-11-13T00:00:00');
        dateObj.setDate(dateObj.getDate() + i);
        const shortDate = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const dayLabel = dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
        });
        const rawForecast =
          modelType === 'HOLT_WINTERS'
            ? basePt.holtWintersQty
            : modelType === 'CHRONOS_BOLT'
              ? basePt.chronosBoltQty
              : basePt.predictedQty;

        points.push({
          date: dateObj.toISOString().slice(0, 10),
          dayLabel,
          shortDate,
          historical: Math.round(
            basePt.historicalQty * scale * (1 + weekIndex * 0.01)
          ),
          forecast: Math.round(rawForecast * scale * growthBoost),
        });
      }
      return points;
    };

    const series = buildPoints();
    const total =
      selectedProductId === 'ALL' &&
      selectedCategory === 'ALL' &&
      horizonDays === 7 &&
      modelType === 'ENSEMBLE'
        ? baseTotal7d
        : series.reduce((s, p) => s + p.forecast, 0);

    let peakPt = series[0];
    for (const pt of series) {
      if (pt.forecast > (peakPt?.forecast ?? 0)) peakPt = pt;
    }

    const fullWeekdayMap: Record<string, string> = {
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
      Sun: 'Sunday',
    };

    const horizonMultiplier =
      horizonDays === 7 ? 1 : horizonDays === 14 ? 2.04 : 4.35;
    const computedRows = matchingRows.map((row) => {
      const pred =
        modelType === 'HOLT_WINTERS'
          ? row.holt_winters_7d
          : modelType === 'CHRONOS_BOLT'
            ? row.chronos_bolt_7d
            : row.predicted_7d;
      return {
        ...row,
        displayHistorical: Math.round(row.historical_7d * horizonMultiplier),
        displayPredicted: Math.round(pred * horizonMultiplier),
      };
    });

    return {
      seriesData: series,
      totalExpectedDemand: total,
      peakDayLabel: peakPt
        ? fullWeekdayMap[peakPt.dayLabel] ?? peakPt.dayLabel
        : 'Saturday',
      filteredProductRows: computedRows,
      insufficientHistoryProducts: newProductsShortHistory,
    };
  }, [
    forecasts,
    products,
    selectedProductId,
    selectedCategory,
    horizonDays,
    modelType,
  ]);

  const derivedRawRows = useMemo(() => {
    const allDerived = calculateDerivedIngredientForecasts(
      products,
      batches,
      forecasts,
      rules,
      groupPolicies,
      horizonDays
    );
    if (selectedCategory === 'ALL') return allDerived;
    return allDerived.filter((d) => {
      const ing = products.find((p) => p.product_id === d.ingredient_id);
      return ing?.category_name === selectedCategory;
    });
  }, [products, batches, forecasts, rules, groupPolicies, horizonDays, selectedCategory]);

  const renderCustomTick = (props: {
    x?: number | string;
    y?: number | string;
    payload?: { value: string; index: number };
  }) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const idx = props.payload?.index ?? 0;
    const pt = seriesData[idx];
    if (!pt) return null;
    if (horizonDays === 30 && idx % 3 !== 0) return null;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={12}
          textAnchor="middle"
          fill="#374151"
          fontSize={11}
          fontWeight={600}
        >
          {pt.dayLabel}
        </text>
        <text x={0} y={26} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
          {pt.shortDate}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Forecast Period</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Calendar className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827]">
            Next {horizonDays} Days
          </p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Expected Demand
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <BarChart2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827] tabular-nums">
            {totalExpectedDemand.toLocaleString()} Units
          </p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Highest Demand</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827]">{peakDayLabel}</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              {tableTab === 'raw_bom' ? 'Raw Ingredients Tracked' : 'Products Forecasted'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827] tabular-nums">
            {tableTab === 'raw_bom'
              ? derivedRawRows.length
              : filteredProductRows.length}
          </p>
        </div>
      </div>

      {/* Sales History & Forecast Accuracy Strip */}
      <div className="acalen-card flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803D]">
            <CheckCircle2 className="h-4 w-4" />
            Sales History: 9 Months (Enough for reliable predictions)
          </span>
          <span className="hidden text-[#CBD5E1] sm:inline">|</span>
          <span className="rounded-md bg-[#EFF3F9] px-2.5 py-0.5 font-semibold text-[#1E325C]">
            Forecast Accuracy: 87.4%
          </span>
        </div>
        <span className="text-[11px] text-[#6B7280]">
          Holt-Winters 84.2% · Chronos-Bolt 86.5% · MAPE 12.6% · RMSE 8.4 · MAE 6.2
        </span>
      </div>

      {/* Filters & Model Selector Bar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-3">
          <label
            htmlFor="fc-product"
            className="mb-1.5 block text-xs font-medium text-[#6B7280]"
          >
            Product
          </label>
          <select
            id="fc-product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3.5 py-2.5 text-xs text-[#111827] shadow-xs focus:border-[#1E325C] focus:outline-none"
          >
            <option value="ALL">All Products</option>
            {forecasts.map((f) => (
              <option key={f.product_id} value={f.product_id}>
                {f.product_name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label
            htmlFor="fc-category"
            className="mb-1.5 block text-xs font-medium text-[#6B7280]"
          >
            Category
          </label>
          <select
            id="fc-category"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedProductId('ALL');
            }}
            className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3.5 py-2.5 text-xs text-[#111827] shadow-xs focus:border-[#1E325C] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.category_id} value={c.category_name}>
                {c.category_name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-[#6B7280]">
            Forecasting Model
          </span>
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value as ForecastModelType)}
            aria-label="Select forecasting model"
            className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3.5 py-2.5 text-xs text-[#111827] shadow-xs focus:border-[#1E325C] focus:outline-none"
          >
            <option value="ENSEMBLE">Hybrid Ensemble (HW + Chronos-Bolt)</option>
            <option value="HOLT_WINTERS">Holt-Winters Seasonal (Statistical)</option>
            <option value="CHRONOS_BOLT">Chronos-Bolt (Foundation ML)</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-[#6B7280]">
            Forecast Period
          </span>
          <div className="grid grid-cols-3 rounded-xl border border-[#E8ECF2] bg-[#F1F5F9] p-1">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizonDays(days)}
                className={`rounded-lg py-1.5 text-xs font-semibold ${
                  horizonDays === days
                    ? 'bg-[#1E325C] text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dual-Line Chart Card */}
      <div className="acalen-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">
              Historical Sales vs. Predicted Demand
            </h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Prior week aligned by weekday · Historical: Nov 6–12, 2026
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs text-[#4B5563]">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-5 bg-[#1E325C]" />
              Historical Demand
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-5 border-t-2 border-dashed border-[#5B7399]" />
              Forecasted Demand
            </span>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1 text-[11px] font-medium text-[#6B7280]">Demand (units)</p>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={seriesData}
                margin={{ top: 22, right: 20, left: -12, bottom: 24 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="shortDate"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={renderCustomTick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E8ECF2',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    `${value} units`,
                    name === 'historical' ? 'Historical Demand' : 'Forecasted Demand',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#1E325C"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={{
                    r: 3.5,
                    fill: '#FFFFFF',
                    stroke: '#1E325C',
                    strokeWidth: 2,
                    strokeDasharray: '0',
                  }}
                  activeDot={{ r: 5, strokeDasharray: '0' }}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#5B7399"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  isAnimationActive={false}
                  dot={{
                    r: 3.5,
                    fill: '#FFFFFF',
                    stroke: '#5B7399',
                    strokeWidth: 2,
                    strokeDasharray: '0',
                  }}
                  activeDot={{ r: 5, strokeDasharray: '0' }}
                >
                  {horizonDays <= 14 && (
                    <LabelList
                      dataKey="forecast"
                      position="top"
                      offset={10}
                      fill="#5B7399"
                      fontSize={11}
                      fontWeight={600}
                    />
                  )}
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Product Demand Predictions vs Derived Raw Ingredient BOM Table */}
      <div className="acalen-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8ECF2] px-6 py-4">
          <div className="inline-flex rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] p-1">
            <button
              type="button"
              onClick={() => setTableTab('finished')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                tableTab === 'finished'
                  ? 'bg-white text-[#1E325C] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Coffee className="h-3.5 w-3.5" />
              Finished Product Demand ({filteredProductRows.length})
            </button>
            <button
              type="button"
              onClick={() => setTableTab('raw_bom')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                tableTab === 'raw_bom'
                  ? 'bg-white text-[#1E325C] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Estimated Ingredient Needs ({derivedRawRows.length})
            </button>
          </div>

          <span className="text-xs text-[#6B7280]">
            {tableTab === 'finished'
              ? modelType === 'ENSEMBLE'
                ? 'Holt-Winters + Chronos-Bolt'
                : modelType === 'HOLT_WINTERS'
                  ? 'Holt-Winters Baseline'
                  : 'Chronos-Bolt ML'
              : `Calculated from menu forecast × recipe amounts (${horizonDays}d)`}
          </span>
        </div>

        {tableTab === 'finished' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
                <tr>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Historical Demand</th>
                  <th className="px-4 py-3.5">Predicted Demand</th>
                  <th className="px-4 py-3.5">Demand Trend</th>
                  <th className="px-6 py-3.5 text-right">Data Readiness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredProductRows.map((row) => (
                  <tr key={row.product_id} className="hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3.5 font-semibold text-[#111827]">
                      {row.product_name}
                    </td>
                    <td className="px-4 py-3.5 text-[#6B7280] tabular-nums">
                      {row.displayHistorical} units
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#111827] tabular-nums">
                      {row.displayPredicted} units
                    </td>
                    <td className="px-4 py-3.5">
                      {row.trend === 'INCREASING' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Increasing
                        </span>
                      ) : row.trend === 'DECREASING' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[#B4690E]">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          Decreasing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-[#6B7280]">
                          <ArrowRight className="h-3.5 w-3.5" />
                          Stable
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="inline-flex rounded-md border border-[#E8ECF2] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#6B7280]">
                        Evaluated (9 mos)
                      </span>
                    </td>
                  </tr>
                ))}
                {insufficientHistoryProducts.map((np) => (
                  <tr key={np.product_id} className="bg-[#FFFBEB]/40">
                    <td className="px-6 py-3.5 font-semibold text-[#111827]">
                      {np.product_name}
                    </td>
                    <td className="px-4 py-3.5 text-[#9CA3AF]">—</td>
                    <td className="px-4 py-3.5 text-[#9CA3AF]">Deferred</td>
                    <td className="px-4 py-3.5 text-[#B4690E]">
                      Requires ≥6 months history
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#FDE68A] bg-[#FFF8EB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B4690E]">
                        <AlertTriangle className="h-3 w-3" />
                        Insufficient History ({np.history_months ?? 0} mos)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
                <tr>
                  <th className="px-6 py-3.5">Raw Ingredient / Supply</th>
                  <th className="px-4 py-3.5">Current Stock</th>
                  <th className="px-4 py-3.5">Est. {horizonDays}-Day Need</th>
                  <th className="px-4 py-3.5">Used By Menu Items</th>
                  <th className="px-4 py-3.5">Expected Leftover</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Supply Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {derivedRawRows.map((row) => (
                  <tr key={row.ingredient_id} className="hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-[#111827]">
                        {row.ingredient_name}
                      </p>
                      <p className="font-mono text-[10px] text-[#9CA3AF]">{row.sku}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#111827] tabular-nums">
                      {formatQty(row.current_stock, row.unit_label)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#1E325C] tabular-nums">
                      {formatQty(row.derived_7d_usage, row.unit_label)}
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-[#4B5563]">
                      {row.contributing_products.length === 0 ? (
                        <span className="text-[#9CA3AF]">No linked recipes</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.contributing_products.slice(0, 3).map((cp) => (
                            <span
                              key={cp.product_id}
                              className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#334155]"
                            >
                              {cp.product_name}:{' '}
                              {formatQty(cp.ingredient_usage, row.unit_label)}
                            </span>
                          ))}
                          {row.contributing_products.length > 3 && (
                            <span className="text-[10px] text-[#6B7280]">
                              +{row.contributing_products.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3.5 font-bold tabular-nums ${
                        row.projected_ending_stock < row.safety_stock
                          ? 'text-[#C53030]'
                          : 'text-[#15803D]'
                      }`}
                    >
                      {formatQty(row.projected_ending_stock, row.unit_label)}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      {row.status === 'SHORTAGE_RISK' ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#C53030]">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
                          May Run Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]" />
                          Enough Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#6B7280]">
        Forecast values are generated from normalized POS history (at least 6 months
        historical baseline recommended in SIA 1 Sec. 1.5) and serve as advisory planning
        references. Raw ingredient forecasts are mathematically derived from finished
        product predictions multiplied by each menu item&apos;s micro-ingredient BOM.
      </p>
    </div>
  );
};
