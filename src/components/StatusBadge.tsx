import React from 'react';
import { ExpiryStatus, RuleTriggeredCode, StockStatus } from '../types/acalen';

export const StockStatusPill: React.FC<{
  stockStatus: StockStatus;
  expiryStatus?: ExpiryStatus;
}> = ({ stockStatus, expiryStatus }) => {
  if (stockStatus === 'OUT_OF_STOCK') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#C53030]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
        Out of Stock
      </span>
    );
  }
  if (stockStatus === 'LOW_STOCK') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8EB] px-2.5 py-1 text-xs font-medium text-[#B4690E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
        Low Stock
      </span>
    );
  }
  if (expiryStatus === 'EXPIRING_SOON' || expiryStatus === 'EXPIRED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8EB] px-2.5 py-1 text-xs font-medium text-[#B4690E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
        {expiryStatus === 'EXPIRED' ? 'Expired' : 'Expiring Soon'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#15803D]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
      In Stock
    </span>
  );
};

export const PriorityPill: React.FC<{ priority: 'HIGH' | 'MEDIUM' | 'LOW' }> = ({
  priority,
}) => {
  const styles =
    priority === 'HIGH'
      ? 'bg-[#FEF2F2] text-[#C53030] border-[#FECACA]'
      : priority === 'MEDIUM'
        ? 'bg-[#FFF8EB] text-[#B4690E] border-[#FDE68A]'
        : 'bg-[#EEF2F7] text-[#334E7B] border-[#D8E1EE]';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${styles}`}
    >
      {priority}
    </span>
  );
};

export const RuleCodeBadge: React.FC<{ code: RuleTriggeredCode }> = ({ code }) => {
  const map: Record<RuleTriggeredCode, { label: string; cls: string }> = {
    STOCK_SHORTAGE: {
      label: 'Low Stock',
      cls: 'bg-[#FEF2F2] text-[#C53030] border-[#FECACA]',
    },
    BELOW_TARGET_MARGIN: {
      label: 'Low Profit',
      cls: 'bg-[#EEF2F7] text-[#1E325C] border-[#D2DCEB]',
    },
    EXPIRY_WARNING: {
      label: 'Expiring Soon',
      cls: 'bg-[#FFF8EB] text-[#B4690E] border-[#FDE68A]',
    },
  };
  const cfg = map[code];
  return (
    <span
      title={code}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
};
