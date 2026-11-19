import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Leaf,
  Package,
  ShieldAlert,
  TrendingDown,
  X,
  XCircle,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { PriorityPill, RuleCodeBadge } from './StatusBadge';

interface AdvisoryReviewModalProps {
  open: boolean;
  onClose: () => void;
  focusRecId?: number | null;
}

export const AdvisoryReviewModal: React.FC<AdvisoryReviewModalProps> = ({
  open,
  onClose,
  focusRecId,
}) => {
  const {
    recommendations,
    updateRecommendationStatus,
    applyRecommendationAction,
  } = useAcalen();

  if (!open) return null;

  const sorted = focusRecId
    ? [
        ...recommendations.filter((r) => r.recommendation_id === focusRecId),
        ...recommendations.filter((r) => r.recommendation_id !== focusRecId),
      ]
    : recommendations;

  const pendingCount = recommendations.filter((r) => r.status === 'PENDING').length;

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'Expiry Management':
        return <Clock className="h-4 w-4 text-[#D97706]" />;
      case 'Waste Reduction':
        return <Leaf className="h-4 w-4 text-[#15803D]" />;
      case 'Margin Advisory':
        return <TrendingDown className="h-4 w-4 text-[#1E325C]" />;
      default:
        return <Package className="h-4 w-4 text-[#1E325C]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advisory-review-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="advisory-review-title"
                className="text-base font-semibold text-[#111827]"
              >
                Manager Advisory Review Queue
              </h2>
              <p className="text-xs text-[#6B7280]">
                {pendingCount} recommendation{pendingCount === 1 ? '' : 's'} awaiting
                management decision · No automatic price or stock changes occur without
                approval
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Close review modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] p-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[#22C55E]" />
              <p className="mt-2 text-sm font-semibold text-[#111827]">
                All inventory &amp; pricing rules healthy
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                No triggered rule alerts require action right now.
              </p>
            </div>
          ) : (
            sorted.map((rec) => {
              const isFocused = focusRecId === rec.recommendation_id;
              return (
                <div
                  key={rec.recommendation_id}
                  className={`rounded-xl border p-4 transition-all ${
                    isFocused
                      ? 'border-[#1E325C] bg-[#F8FAFD] ring-2 ring-[#1E325C]/10'
                      : 'border-[#E8ECF2] bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6]">
                        {categoryIcon(rec.category)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[#6B7280]">
                            {rec.category}
                          </span>
                          <PriorityPill priority={rec.priority} />
                          {rec.all_rules_triggered.map((code) => (
                            <RuleCodeBadge key={code} code={code} />
                          ))}
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-[#111827]">
                          {rec.short_title}
                        </h3>
                      </div>
                    </div>

                    <div>
                      {rec.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8EB] px-2.5 py-1 text-xs font-medium text-[#B4690E]">
                          <AlertTriangle className="h-3 w-3" />
                          Awaiting Review
                        </span>
                      ) : rec.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#15803D]">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#6B7280]">
                          <XCircle className="h-3 w-3" />
                          Dismissed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 rounded-lg border border-[#E8ECF2] bg-[#F9FAFB] p-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-[#374151]">Evidence</p>
                      <p className="mt-0.5 leading-relaxed text-[#4B5563]">
                        {rec.evidence}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#374151]">
                        Calculated Recommendation
                      </p>
                      <p className="mt-0.5 leading-relaxed text-[#4B5563]">
                        {rec.recommended_action}
                      </p>
                    </div>
                  </div>

                  {rec.status === 'PENDING' && (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateRecommendationStatus(rec.recommendation_id, 'DISMISSED')
                        }
                        className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateRecommendationStatus(rec.recommendation_id, 'APPROVED')
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E325C] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E325C] hover:bg-[#EFF3F9]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve Advisory
                      </button>
                      {(rec.suggested_markdown_price ||
                        rec.suggested_reorder_qty ||
                        rec.suggested_price) && (
                        <button
                          type="button"
                          onClick={() => applyRecommendationAction(rec.recommendation_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E325C] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#162647]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {rec.suggested_markdown_price
                            ? `Apply ₱${rec.suggested_markdown_price} Markdown`
                            : rec.suggested_reorder_qty
                              ? `Log +${rec.suggested_reorder_qty} Restock`
                              : `Apply ₱${rec.suggested_price} Price`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E8ECF2] bg-[#F9FAFB] px-6 py-3">
          <p className="text-[11px] text-[#6B7280]">
            Ethical AI Policy (Sec. 4.4): Forecasts are estimates; manager retains final
            operational authority.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1E325C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#162647]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
