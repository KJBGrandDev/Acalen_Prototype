import React, { useMemo, useState } from 'react';
import { ClipboardList, ShieldCheck, X } from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { AuditLogEntry } from '../types/acalen';

interface AuditLogModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ open, onClose }) => {
  const { auditLogs } = useAcalen();
  const [moduleFilter, setModuleFilter] = useState<'ALL' | AuditLogEntry['module']>('ALL');

  const filtered = useMemo(() => {
    if (moduleFilter === 'ALL') return auditLogs;
    return auditLogs.filter((l) => l.module === moduleFilter);
  }, [auditLogs, moduleFilter]);

  if (!open) return null;

  const badgeClass = (mod: AuditLogEntry['module']) => {
    switch (mod) {
      case 'POS':
        return 'bg-[#ECFDF3] text-[#15803D]';
      case 'INVENTORY':
        return 'bg-[#FFF8EB] text-[#B4690E]';
      case 'RULES':
        return 'bg-[#EFF3F9] text-[#1E325C]';
      case 'ACALEN_ENGINE':
        return 'bg-[#EEF2F7] text-[#334E7B]';
      default:
        return 'bg-[#F3F4F6] text-[#374151]';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-log-title"
    >
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 id="audit-log-title" className="text-base font-semibold text-[#111827]">
                System Audit &amp; Activity Log
              </h2>
              <p className="text-xs text-[#6B7280]">
                Middleware transaction, RBAC &amp; decision-support audit trail (Republic Act No. 10173 compliance)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Close audit log"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] bg-[#F9FAFB] px-6 py-3">
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'AUTH', 'POS', 'INVENTORY', 'RULES', 'ACALEN_ENGINE'] as const).map(
              (mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setModuleFilter(mod)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                    moduleFilter === mod
                      ? 'bg-[#1E325C] text-white'
                      : 'border border-[#E2E8F0] bg-white text-[#4B5563] hover:bg-[#F3F4F6]'
                  }`}
                >
                  {mod === 'ALL' ? `All (${auditLogs.length})` : mod}
                </button>
              )
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#1E325C]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Immutable Audit Stream
          </span>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8ECF2] text-[11px] font-medium text-[#6B7280]">
              <tr>
                <th className="py-2.5 pr-4">Timestamp</th>
                <th className="px-3 py-2.5">Actor &amp; Role</th>
                <th className="px-3 py-2.5">Module</th>
                <th className="px-3 py-2.5">Endpoint / Action</th>
                <th className="py-2.5 pl-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((entry) => (
                <tr key={entry.log_id} className="align-top hover:bg-[#F9FAFB]">
                  <td className="py-3 pr-4 font-mono text-[11px] whitespace-nowrap text-[#6B7280]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <p className="font-semibold text-[#111827]">{entry.actor_name}</p>
                    <p className="text-[10px] font-medium text-[#6B7280]">
                      {entry.actor_role}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${badgeClass(
                        entry.module
                      )}`}
                    >
                      {entry.module}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] font-semibold text-[#1E325C]">
                    {entry.action}
                  </td>
                  <td className="py-3 pl-3 leading-relaxed text-[#374151]">
                    {entry.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
