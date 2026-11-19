import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';

interface AcalenPipelineModalProps {
  open: boolean;
  onClose: () => void;
  autoRun?: boolean;
}

export const AcalenPipelineModal: React.FC<AcalenPipelineModalProps> = ({
  open,
  onClose,
  autoRun = false,
}) => {
  const { latestContract, triggerAnalysisRun, lastAnalysisRunAt } = useAcalen();
  const [stage, setStage] = useState<number>(3);
  const [running, setRunning] = useState(false);
  const [jsonTab, setJsonTab] = useState<'response' | 'request'>('response');

  const startPipeline = () => {
    setRunning(true);
    setStage(0);
    setTimeout(() => setStage(1), 260);
    setTimeout(() => setStage(2), 560);
    setTimeout(() => {
      triggerAnalysisRun('manual_dashboard_run');
      setStage(3);
      setRunning(false);
    }, 900);
  };

  useEffect(() => {
    if (open && autoRun) {
      startPipeline();
    } else if (open) {
      setStage(3);
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRun]);

  if (!open) return null;

  const steps = [
    {
      icon: Database,
      title: '1. Data Preprocessing Pipeline',
      detail:
        'Reads normalized PostgreSQL sales & batch tables via read-only contract; removes duplicates, fills zero-sale dates, and aggregates daily series.',
    },
    {
      icon: Cpu,
      title: '2. Predictive Demand Forecasting',
      detail:
        'Executes Holt-Winters seasonal smoothing (statsmodels) & pretrained Chronos-Bolt foundation model over 7-day horizon (Accuracy 87.4% · MAPE 12.6%).',
    },
    {
      icon: ShieldCheck,
      title: '3. Multi-Factor Rule-Based Decision Layer',
      detail:
        'Evaluates predicted demand against batch stock, safety stock, reorder level, target gross margin, and expiry warning thresholds.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acalen-pipeline-title"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="acalen-pipeline-title"
                className="text-base font-semibold text-[#111827]"
              >
                Acalen Analytical Engine · Service Contract
              </h2>
              <p className="text-xs text-[#6B7280]">
                Internal Contract <code className="font-mono">run_acalen_analysis</code> ·{' '}
                <code className="font-mono">POST /api/acalen/analyze</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
          {/* Pipeline Steps */}
          <div className="grid gap-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const done = stage > idx;
              const active = running && stage === idx;
              return (
                <div
                  key={step.title}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    done
                      ? 'border-[#BBF7D0] bg-[#F6FEF9]'
                      : active
                        ? 'border-[#1E325C] bg-[#EFF3F9]'
                        : 'border-[#E8ECF2] bg-[#F9FAFB]'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      done
                        ? 'bg-[#DCFCE7] text-[#15803D]'
                        : active
                          ? 'bg-[#1E325C] text-white'
                          : 'bg-white text-[#6B7280] border border-[#E5E7EB]'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className={`h-4 w-4 ${active ? 'animate-pulse' : ''}`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#111827]">{step.title}</p>
                      <span
                        className={`text-[11px] font-medium ${
                          done
                            ? 'text-[#15803D]'
                            : active
                              ? 'text-[#1E325C]'
                              : 'text-[#9CA3AF]'
                        }`}
                      >
                        {done ? 'Completed' : active ? 'Processing...' : 'Queued'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">
                      {step.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Model Accuracy Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Holdout Accuracy', value: `${latestContract.response.metrics.holdout_accuracy_pct}%` },
              { label: 'MAPE', value: `${latestContract.response.metrics.mape_pct}%` },
              { label: 'RMSE', value: `${latestContract.response.metrics.rmse}` },
              { label: 'MAE', value: `${latestContract.response.metrics.mae}` },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] px-3 py-2.5"
              >
                <p className="text-[11px] font-medium text-[#6B7280]">{m.label}</p>
                <p className="mt-0.5 text-base font-bold text-[#1E325C] tabular-nums">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* JSON Contract Viewer */}
          <div className="overflow-hidden rounded-xl border border-[#E8ECF2] bg-[#0F172A] text-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#162033] px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Code2 className="h-4 w-4 text-sky-300" />
                <span>JSON Payload Exchange (SIA 1 Sec. 6.5)</span>
              </div>
              <div className="flex rounded-lg bg-slate-900 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setJsonTab('response')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    jsonTab === 'response'
                      ? 'bg-[#1E325C] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Response Output
                </button>
                <button
                  type="button"
                  onClick={() => setJsonTab('request')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    jsonTab === 'request'
                      ? 'bg-[#1E325C] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Read-Only Input
                </button>
              </div>
            </div>
            <pre className="max-h-60 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
              {JSON.stringify(
                jsonTab === 'response' ? latestContract.response : latestContract.request,
                null,
                2
              )}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8ECF2] bg-[#F9FAFB] px-6 py-3.5">
          <p className="text-xs text-[#6B7280]">
            Last evaluated:{' '}
            <span className="font-medium text-[#374151]">
              {new Date(lastAnalysisRunAt).toLocaleString()}
            </span>
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={startPipeline}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:bg-[#F3F4F6] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {running ? 'Running Engine...' : 'Re-Run Analysis'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#1E325C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#162647]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
