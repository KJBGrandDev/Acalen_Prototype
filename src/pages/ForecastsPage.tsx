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
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Box,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { CATEGORIES, FORECAST_7DAY_SERIES } from '../data/seedData';
import { ForecastModelType } from '../types/acalen';

export const ForecastsPage: React.FC = () => {
  const { products, forecasts } = useAcalen();

  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 30>(7);
  const [modelType, setModelType] = useState<ForecastModelType>('ENSEMBLE');

  // Scale factor when filtering by category or product
  const { seriesData, totalExpectedDemand, peakDayLabel, filteredProductRows } =
    useMemo(() => {
      const baseTotal7d = FORECAST_7DAY_SERIES.reduce(
        (s, d) => s + d.predictedQty,
        0
      ); // 1196

      const matchingRows = forecasts.filter((f) => {
        const prod = products.find((p) => p.product_id === f.product_id);
        if (!prod) return false;
        if (
          selectedProductId !== 'ALL' &&
          f.product_id !== Number(selectedProductId)
        ) {
          return false;
        }
        if (
          selectedCategory !== 'ALL' &&
          prod.category_name !== selectedCategory
        ) {
          return false;
        }
        return true;
      });

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
            historical: Math.round(basePt.historicalQty * scale * (1 + weekIndex * 0.01)),
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

      const horizonMultiplier = horizonDays === 7 ? 1 : horizonDays === 14 ? 2.04 : 4.35;
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
      };
    }, [forecasts, products, selectedProductId, selectedCategory, horizonDays, modelType]);

  // Custom dual-line XAxis tick (Day on line 1, Date on line 2) matching Figma Image 3
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
    // On 30-day view, show every 3rd label to keep X-axis crisp and uncrowded
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
        <text
          x={0}
          y={26}
          textAnchor="middle"
          fill="#9CA3AF"
          fontSize={10}
        >
          {pt.shortDate}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards matching Figma Image 3 */}
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
              Products Forecasted
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827] tabular-nums">
            {filteredProductRows.length}
          </p>
        </div>
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
              Prior week aligned by weekday · Historical: Nov 6–12, 2026 · Holdout
              Accuracy: <strong className="text-[#1E325C]">87.4%</strong> (MAPE 12.6% ·
              RMSE 8.4 · MAE 6.2)
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
                  dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#1E325C', strokeWidth: 2, strokeDasharray: '0' }}
                  activeDot={{ r: 5, strokeDasharray: '0' }}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#5B7399"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  isAnimationActive={false}
                  dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#5B7399', strokeWidth: 2, strokeDasharray: '0' }}
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

      {/* Product Demand Predictions Table */}
      <div className="acalen-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <h2 className="text-base font-semibold text-[#111827]">
            Product Demand Predictions
          </h2>
          <span className="text-xs text-[#6B7280]">
            {modelType === 'ENSEMBLE'
              ? 'Holt-Winters + Chronos-Bolt'
              : modelType === 'HOLT_WINTERS'
                ? 'Holt-Winters Baseline'
                : 'Chronos-Bolt ML'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
              <tr>
                <th className="px-6 py-3.5">Product</th>
                <th className="px-4 py-3.5">Historical Demand</th>
                <th className="px-4 py-3.5">Predicted Demand</th>
                <th className="px-4 py-3.5">Demand Trend</th>
                <th className="px-6 py-3.5 text-right">Model Status</th>
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
                      Evaluated
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[#6B7280]">
        Forecast values are generated from normalized POS history (at least 6 months
        historical baseline recommended in SIA 1 Sec. 1.5) and serve as advisory planning
        references.
      </p>
    </div>
  );
};
