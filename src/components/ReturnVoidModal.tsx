import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { formatPeso } from '../engine/acalenEngine';
import { SalesOrder } from '../types/acalen';

const REASON_CODES = [
  { id: 'WRONG_ITEM', label: 'Wrong Item / Entry Error' },
  { id: 'CUSTOMER_CHANGED_MIND', label: 'Customer Changed Mind' },
  { id: 'QUALITY_ISSUE', label: 'Quality / Prep Issue' },
  { id: 'DUPLICATE_ORDER', label: 'Duplicate Order' },
  { id: 'OTHER', label: 'Other' },
] as const;

type ReasonCodeId = (typeof REASON_CODES)[number]['id'];

interface ReturnVoidModalProps {
  order: SalesOrder;
  onClose: () => void;
  onConfirm: (params: {
    orderId: number;
    mode: 'VOID_ORDER' | 'RETURN_ITEM';
    itemsToReturn?: Array<{ itemId: number; returnQty: number }>;
    reason: string;
  }) => void;
}

export const ReturnVoidModal: React.FC<ReturnVoidModalProps> = ({
  order,
  onClose,
  onConfirm,
}) => {
  const [actionMode, setActionMode] = useState<'RETURN_ITEM' | 'VOID_ORDER'>('RETURN_ITEM');
  const [selectedQtyByItem, setSelectedQtyByItem] = useState<Record<number, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCodeId | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  // Ratio to accurately prorate refunds on Senior/PWD discounted orders
  const effectivePriceFactor = useMemo(() => {
    if (order.subtotal <= 0) return 1;
    return order.total_amount / order.subtotal;
  }, [order.subtotal, order.total_amount]);

  const remainingItems = useMemo(
    () =>
      order.items.map((item) => ({
        ...item,
        remainingQty: Math.max(0, item.quantity - item.returned_qty),
      })),
    [order.items]
  );

  const totalRemainingUnits = useMemo(
    () => remainingItems.reduce((sum, item) => sum + item.remainingQty, 0),
    [remainingItems]
  );

  const totalRemainingRefund = useMemo(() => {
    const raw = remainingItems.reduce(
      (sum, item) => sum + item.remainingQty * item.unit_price,
      0
    );
    return Number((raw * effectivePriceFactor).toFixed(2));
  }, [remainingItems, effectivePriceFactor]);

  const selectedReturnEntries = useMemo(() => {
    return remainingItems
      .map((item) => ({
        item,
        returnQty: Math.min(selectedQtyByItem[item.item_id] ?? 0, item.remainingQty),
      }))
      .filter((entry) => entry.returnQty > 0);
  }, [remainingItems, selectedQtyByItem]);

  const partialReturnUnits = useMemo(
    () => selectedReturnEntries.reduce((sum, entry) => sum + entry.returnQty, 0),
    [selectedReturnEntries]
  );

  const partialReturnRefund = useMemo(() => {
    const raw = selectedReturnEntries.reduce(
      (sum, entry) => sum + entry.returnQty * entry.item.unit_price,
      0
    );
    return Number((raw * effectivePriceFactor).toFixed(2));
  }, [selectedReturnEntries, effectivePriceFactor]);

  const activeRefundAmount =
    actionMode === 'VOID_ORDER' ? totalRemainingRefund : partialReturnRefund;
  const activeRestoreUnits =
    actionMode === 'VOID_ORDER' ? totalRemainingUnits : partialReturnUnits;

  const selectedReasonLabel = useMemo(() => {
    const found = REASON_CODES.find((r) => r.id === reasonCode);
    if (!found) return '';
    if (reasonCode === 'OTHER') {
      return customNote.trim() ? `Other: ${customNote.trim()}` : '';
    }
    return customNote.trim() ? `${found.label} (${customNote.trim()})` : found.label;
  }, [reasonCode, customNote]);

  const canProceedToConfirm =
    Boolean(selectedReasonLabel) &&
    (actionMode === 'VOID_ORDER' ? totalRemainingUnits > 0 : partialReturnUnits > 0);

  const setItemQty = (itemId: number, qty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(qty, maxQty));
    setSelectedQtyByItem((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const handleFinalConfirm = () => {
    if (!selectedReasonLabel) return;
    if (actionMode === 'VOID_ORDER') {
      onConfirm({
        orderId: order.order_id,
        mode: 'VOID_ORDER',
        reason: selectedReasonLabel,
      });
    } else {
      onConfirm({
        orderId: order.order_id,
        mode: 'RETURN_ITEM',
        itemsToReturn: selectedReturnEntries.map((e) => ({
          itemId: e.item.item_id,
          returnQty: e.returnQty,
        })),
        reason: selectedReasonLabel,
      });
    }
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#E8ECF2] bg-[#F9FAFB] px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="return-modal-title"
                className="text-base font-semibold text-[#111827]"
              >
                {step === 'confirm' ? 'Confirm Adjustment' : 'Return / Void Order'}
              </h2>
              <span className="rounded-md bg-[#E2E8F0]/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#1E325C]">
                {order.receipt_no}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280]">
              <span>
                {new Date(order.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {order.cashier_name}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#374151]">
                {order.payment_method === 'CASH' ? (
                  <>
                    <CreditCard className="h-3 w-3 text-[#6B7280]" />
                    Cash Tender
                  </>
                ) : (
                  <>
                    <Smartphone className="h-3 w-3 text-[#6B7280]" />
                    E-Wallet ({order.ewallet_ref ?? 'Ref'})
                  </>
                )}
              </span>
              {order.discount_type !== 'NONE' && (
                <>
                  <span>·</span>
                  <span className="rounded bg-[#ECFDF3] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803D]">
                    {order.discount_type === 'SENIOR_CITIZEN' ? 'Senior 20%' : 'PWD 20%'}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#E5E7EB]/60"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'select' ? (
          <div className="space-y-4 p-6">
            {/* Segmented Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => setActionMode('RETURN_ITEM')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  actionMode === 'RETURN_ITEM'
                    ? 'bg-white text-[#1E325C] shadow-sm'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Partial Item Return
              </button>
              <button
                type="button"
                onClick={() => setActionMode('VOID_ORDER')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  actionMode === 'VOID_ORDER'
                    ? 'bg-[#C53030] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#C53030]'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {order.status === 'PARTIAL_RETURN'
                  ? 'Void Remaining Order'
                  : 'Void Full Order'}
              </button>
            </div>

            {/* Mode Content */}
            {actionMode === 'RETURN_ITEM' ? (
              <div className="space-y-2 rounded-xl border border-[#E8ECF2] bg-[#F9FAFB] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4B5563]">
                    Select Items to Return (FEFO Restored)
                  </p>
                  <span className="text-[11px] text-[#6B7280]">
                    {totalRemainingUnits} returnable
                  </span>
                </div>

                <div className="divide-y divide-[#E8ECF2]">
                  {remainingItems.map((item) => {
                    const isFullyReturned = item.remainingQty === 0;
                    const selectedQty = selectedQtyByItem[item.item_id] ?? 0;
                    const itemUnitRefund = Number(
                      (item.unit_price * effectivePriceFactor).toFixed(2)
                    );

                    return (
                      <div
                        key={item.item_id}
                        className={`flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1 ${
                          isFullyReturned ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={`truncate text-xs font-medium ${
                                isFullyReturned
                                  ? 'text-[#6B7280] line-through'
                                  : 'text-[#111827]'
                              }`}
                            >
                              {item.quantity}× {item.product_name}
                            </p>
                            {isFullyReturned && (
                              <span className="shrink-0 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-semibold text-[#C53030]">
                                Returned
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#6B7280]">
                            <span className="font-semibold text-[#374151] tabular-nums">
                              {formatPeso(itemUnitRefund, itemUnitRefund % 1 !== 0)}
                            </span>{' '}
                            each ·{' '}
                            <span className="font-mono text-[10px]">
                              {item.batch_number}
                            </span>
                            {!isFullyReturned && item.returned_qty > 0 && (
                              <span className="ml-1.5 text-[#B4690E]">
                                · {item.remainingQty} left
                              </span>
                            )}
                          </p>
                        </div>

                        {!isFullyReturned && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className="inline-flex items-center rounded-lg border border-[#D1D5DB] bg-white">
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQty(
                                    item.item_id,
                                    selectedQty - 1,
                                    item.remainingQty
                                  )
                                }
                                disabled={selectedQty <= 0}
                                className="flex h-7 w-7 items-center justify-center text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-35"
                                aria-label={`Decrease return quantity for ${item.product_name}`}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-bold text-[#111827] tabular-nums">
                                {selectedQty}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQty(
                                    item.item_id,
                                    selectedQty + 1,
                                    item.remainingQty
                                  )
                                }
                                disabled={selectedQty >= item.remainingQty}
                                className="flex h-7 w-7 items-center justify-center text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-35"
                                aria-label={`Increase return quantity for ${item.product_name}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            {selectedQty < item.remainingQty ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQty(
                                    item.item_id,
                                    item.remainingQty,
                                    item.remainingQty
                                  )
                                }
                                className="rounded-md border border-[#D1D5DB] bg-white px-2 py-1 text-[11px] font-medium text-[#1E325C] hover:bg-[#EFF6FF]"
                              >
                                {item.remainingQty === 1 ? 'Select' : 'All'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQty(item.item_id, 0, item.remainingQty)
                                }
                                className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2 py-1 text-[11px] font-medium text-[#C53030] hover:bg-[#FEE2E2]"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C53030]" />
                  <div className="text-xs text-[#7F1D1D]">
                    <p className="font-semibold">
                      {order.status === 'PARTIAL_RETURN'
                        ? 'Void all remaining unreturned items on this order?'
                        : 'Void entire order and reverse full payment?'}
                    </p>
                    <p className="mt-1 text-[11px] text-[#991B1B]">
                      This marks <span className="font-mono font-semibold">{order.receipt_no}</span>{' '}
                      as <span className="font-semibold">Voided</span>, restores{' '}
                      <span className="font-semibold">{totalRemainingUnits} unit(s)</span>{' '}
                      to FEFO batches (plus deducted raw ingredients), and logs a full audit
                      entry.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* One-Tap Reason Code Chips */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#374151]">
                Reason Code <span className="text-[#C53030]">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REASON_CODES.map((code) => {
                  const active = reasonCode === code.id;
                  return (
                    <button
                      key={code.id}
                      type="button"
                      onClick={() => setReasonCode(code.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-[#1E325C] bg-[#1E325C] text-white'
                          : 'border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      {code.label}
                    </button>
                  );
                })}
              </div>

              {(reasonCode === 'OTHER' || reasonCode !== null) && (
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder={
                    reasonCode === 'OTHER'
                      ? 'Enter specific reason (required)...'
                      : 'Optional note for audit log...'
                  }
                  className="mt-2 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-xs focus:border-[#1E325C] focus:outline-none"
                />
              )}
            </div>

            {/* Live Refund & Tender Preview Bar */}
            <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <div>
                <p className="text-[11px] font-medium text-[#64748B]">
                  Refund to {order.payment_method === 'CASH' ? 'Customer (Cash Drawer)' : `E-Wallet (${order.ewallet_ref ?? 'Ref'})`}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  Restores {activeRestoreUnits} unit(s) to FEFO stock
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#111827] tabular-nums">
                  {formatPeso(activeRefundAmount, activeRefundAmount % 1 !== 0)}
                </p>
                {order.discount_type !== 'NONE' && activeRefundAmount > 0 && (
                  <p className="text-[10px] text-[#15803D]">
                    Prorated for {order.discount_type === 'SENIOR_CITIZEN' ? 'Senior' : 'PWD'} discount
                  </p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canProceedToConfirm}
                onClick={() => setStep('confirm')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  actionMode === 'VOID_ORDER'
                    ? 'bg-[#C53030] hover:bg-[#9B2C2C]'
                    : 'bg-[#1E325C] hover:bg-[#162647]'
                }`}
              >
                {actionMode === 'VOID_ORDER'
                  ? `Review Void (${formatPeso(activeRefundAmount, activeRefundAmount % 1 !== 0)})`
                  : `Review Refund (${formatPeso(activeRefundAmount, activeRefundAmount % 1 !== 0)})`}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Final Confirmation Checkpoint */
          <div className="space-y-4 p-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                <span className="text-xs font-semibold text-[#475569]">Action Type</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    actionMode === 'VOID_ORDER'
                      ? 'bg-[#FEF2F2] text-[#C53030]'
                      : 'bg-[#FFF8EB] text-[#B4690E]'
                  }`}
                >
                  {actionMode === 'VOID_ORDER' ? (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Full Order Void
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3 w-3" />
                      Partial Item Return
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-[#374151]">Items Affected</p>
                {(actionMode === 'VOID_ORDER'
                  ? remainingItems
                      .filter((i) => i.remainingQty > 0)
                      .map((i) => ({ item: i, returnQty: i.remainingQty }))
                  : selectedReturnEntries
                ).map(({ item, returnQty }) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between text-[#4B5563]"
                  >
                    <span>
                      {returnQty}× {item.product_name}{' '}
                      <span className="font-mono text-[10px] text-[#9CA3AF]">
                        ({item.batch_number})
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatPeso(
                        returnQty * item.unit_price * effectivePriceFactor,
                        (returnQty * item.unit_price * effectivePriceFactor) % 1 !== 0
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 border-t border-[#E2E8F0] pt-2.5 text-xs">
                <div className="flex justify-between text-[#4B5563]">
                  <span>Reason</span>
                  <span className="font-medium text-[#111827]">{selectedReasonLabel}</span>
                </div>
                <div className="flex justify-between text-[#4B5563]">
                  <span>Refund Tender</span>
                  <span className="font-medium text-[#111827]">
                    {order.payment_method === 'CASH'
                      ? 'Cash (from Drawer)'
                      : `E-Wallet (${order.ewallet_ref ?? 'Ref'})`}
                  </span>
                </div>
                <div className="flex justify-between text-[#4B5563]">
                  <span>FEFO Inventory Restore</span>
                  <span className="font-semibold text-[#15803D]">
                    +{activeRestoreUnits} unit(s)
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-bold text-[#111827]">
                  <span>Total Refund Due</span>
                  <span className="text-[#C53030] tabular-nums">
                    {formatPeso(activeRefundAmount, activeRefundAmount % 1 !== 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                  actionMode === 'VOID_ORDER'
                    ? 'bg-[#C53030] hover:bg-[#9B2C2C]'
                    : 'bg-[#15803D] hover:bg-[#166534]'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {actionMode === 'VOID_ORDER'
                  ? 'Confirm Void Order'
                  : 'Confirm & Process Refund'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
