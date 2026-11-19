import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Box,
  Clock,
  CreditCard,
  Leaf,
  Lightbulb,
  PackageCheck,
  Receipt,
  TrendingDown,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { DASHBOARD_7DAY_BARS, REFERENCE_TODAY } from '../data/seedData';
import {
  formatPeso,
  getEarliestActiveBatch,
  getExpiryStatus,
  getProductStock,
  getStockStatus,
} from '../engine/acalenEngine';
import { AdvisoryReviewModal } from '../components/AdvisoryReviewModal';

export const DashboardPage: React.FC = () => {
  const {
    products,
    batches,
    rules,
    recommendations,
    todaySalesTotal,
    todayOrderCount,
    setActiveTab,
  } = useAcalen();

  const [showHistoricalComparison, setShowHistoricalComparison] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [focusRecId, setFocusRecId] = useState<number | null>(null);

  const { belowSafetyCount, expiringSoonCount } = useMemo(() => {
    let belowSafety = 0;
    let expiring = 0;

    for (const product of products) {
      if (product.status !== 'ACTIVE') continue;
      const rule = rules.find((r) => r.product_id === product.product_id);
      const safety = rule?.safety_stock ?? 10;
      const warnDays = rule?.expiry_warning_days ?? 7;

      const qty = getProductStock(batches, product.product_id);
      const stockStatus = getStockStatus(qty, safety);
      if (stockStatus === 'LOW_STOCK') {
        belowSafety += 1;
      }

      const earliest = getEarliestActiveBatch(batches, product.product_id);
      if (earliest && earliest.qty_on_hand > 0) {
        const expStatus = getExpiryStatus(
          earliest.expiration_date,
          warnDays,
          REFERENCE_TODAY
        );
        if (expStatus === 'EXPIRING_SOON' || expStatus === 'EXPIRED') {
          expiring += 1;
        }
      }
    }
    return { belowSafetyCount: belowSafety, expiringSoonCount: expiring };
  }, [products, batches, rules]);

  const topRecommendations = useMemo(() => {
    const pending = recommendations.filter((r) => r.status === 'PENDING');
    return (pending.length > 0 ? pending : recommendations).slice(0, 4);
  }, [recommendations]);

  const pendingCount = recommendations.filter((r) => r.status === 'PENDING').length;

  const badgeStyle = (category: string) => {
    switch (category) {
      case 'Expiry Management':
        return {
          wrap: 'bg-[#FFF8EB] text-[#B4690E]',
          label: 'text-[#B4690E]',
          Icon: Clock,
        };
      case 'Waste Reduction':
        return {
          wrap: 'bg-[#ECFDF3] text-[#15803D]',
          label: 'text-[#15803D]',
          Icon: Leaf,
        };
      case 'Margin Advisory':
        return {
          wrap: 'bg-[#EEF2F7] text-[#1E325C]',
          label: 'text-[#1E325C]',
          Icon: TrendingDown,
        };
      default:
        return {
          wrap: 'bg-[#EFF3F9] text-[#1E325C]',
          label: 'text-[#1E325C]',
          Icon: Box,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards (Manuscript Sec. 6.6.2 + Figma Image 2) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Today&apos;s Sales</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#111827] tabular-nums sm:text-[28px]">
            {formatPeso(todaySalesTotal)}
          </p>
          <p className="mt-1.5 text-xs text-[#6B7280]">Updated live from POS checkout</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Orders Today</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569]">
              <Receipt className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#111827] tabular-nums sm:text-[28px]">
            {todayOrderCount}
          </p>
          <p className="mt-1.5 text-xs text-[#6B7280]">Completed counter transactions</p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className="acalen-card p-5 text-left hover:border-[#CBD5E1]"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Items Below Safety Stock
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#111827] tabular-nums sm:text-[28px]">
            {belowSafetyCount}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#B4690E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
            Requires attention
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className="acalen-card p-5 text-left hover:border-[#CBD5E1]"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">
              Items Nearing Expiry
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#C53030]">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#111827] tabular-nums sm:text-[28px]">
            {expiringSoonCount}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-[#C53030]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
            Within 7-day expiry window
          </p>
        </button>
      </div>

      {/* Main Split Row: 7-Day Demand Forecast Chart + Advisory Recommendations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* 7-Day Demand Forecast Bar Chart */}
        <div className="acalen-card flex flex-col justify-between p-6 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                7-Day Demand Forecast
              </h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                Holt-Winters &amp; Chronos-Bolt ensemble forecast (units)
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setShowHistoricalComparison(false)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  !showHistoricalComparison
                    ? 'bg-white text-[#1E325C] shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Forecast
              </button>
              <button
                type="button"
                onClick={() => setShowHistoricalComparison(true)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  showHistoricalComparison
                    ? 'bg-white text-[#1E325C] shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                + Prior Week
              </button>
            </div>
          </div>

          <div className="mt-6 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={DASHBOARD_7DAY_BARS}
                margin={{ top: 24, right: 12, left: -12, bottom: 4 }}
                barCategoryGap="26%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="day"
                  interval={0}
                  padding={{ left: 6, right: 6 }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 250]}
                  ticks={[0, 50, 100, 150, 200, 250]}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  label={{
                    value: 'Forecast Demand (Units)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 18,
                    style: { fill: '#6B7280', fontSize: 11 },
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9', opacity: 0.6 }}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E8ECF2',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    `${value} units`,
                    name === 'demand' ? 'Predicted Demand' : 'Prior Week Actual',
                  ]}
                />
                {showHistoricalComparison && (
                  <Bar
                    dataKey="historical"
                    fill="#CBD5E1"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                    isAnimationActive={false}
                  />
                )}
                <Bar
                  dataKey="demand"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                >
                  {DASHBOARD_7DAY_BARS.map((entry) => (
                    <Cell
                      key={entry.day}
                      fill={entry.day === 'Sunday' ? '#566E96' : '#1E325C'}
                    />
                  ))}
                  <LabelList
                    dataKey="demand"
                    position="top"
                    fill="#374151"
                    fontSize={11}
                    fontWeight={600}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Acalen Advisory Recommendations Card */}
        <div className="acalen-card flex flex-col justify-between p-6 xl:col-span-5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
                  <Lightbulb className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[#111827]">
                    Acalen Advisory Recommendations
                  </h2>
                  <p className="text-xs text-[#6B7280]">Actionable inventory insights</p>
                </div>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#EFF3F9] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E325C] tabular-nums">
                {pendingCount} pending
              </span>
            </div>

            <div className="mt-5 divide-y divide-[#F1F5F9]">
              {topRecommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <PackageCheck className="h-8 w-8 text-[#22C55E]" />
                  <p className="mt-2 text-sm font-medium text-[#111827]">
                    No pending recommendations
                  </p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">
                    All business rule thresholds are currently satisfied.
                  </p>
                </div>
              ) : (
                topRecommendations.map((rec) => {
                  const cfg = badgeStyle(rec.category);
                  const Icon = cfg.Icon;
                  return (
                    <button
                      key={rec.recommendation_id}
                      type="button"
                      onClick={() => {
                        setFocusRecId(rec.recommendation_id);
                        setReviewOpen(true);
                      }}
                      className="flex w-full items-start gap-3.5 py-4 text-left transition-colors first:pt-1 hover:bg-[#F9FAFB]"
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.wrap}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-semibold ${cfg.label}`}>
                            {rec.category}
                          </span>
                          {rec.status !== 'PENDING' && (
                            <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]">
                              {rec.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                          {rec.short_title}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6B7280]">
                          {rec.short_subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
            <button
              type="button"
              onClick={() => setActiveTab('forecasts')}
              className="text-xs font-medium text-[#6B7280] hover:text-[#1E325C]"
            >
              View 7-day forecast details
            </button>
            <button
              type="button"
              onClick={() => {
                setFocusRecId(null);
                setReviewOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E325C] hover:underline"
            >
              Review all advisories
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AdvisoryReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        focusRecId={focusRecId}
      />
    </div>
  );
};
