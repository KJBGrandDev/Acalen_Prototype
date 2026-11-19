import React, { useMemo, useState } from 'react';
import {
  Check,
  CreditCard,
  History,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import {
  calculateOrderTotals,
  formatPeso,
  getProductStock,
} from '../engine/acalenEngine';
import { DiscountType, PaymentMethod, SalesOrder } from '../types/acalen';

const POS_CATEGORIES = ['All Products', 'Coffee', 'Beverages', 'Pastries', 'Food'] as const;

export const PosPage: React.FC = () => {
  const {
    products,
    batches,
    cart,
    orders,
    addToCart,
    updateCartQty,
    clearCart,
    completeSale,
    processReturnOrVoid,
    pushToast,
  } = useAcalen();

  const [mode, setMode] = useState<'counter' | 'history'>('counter');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Products');
  const [discountType, setDiscountType] = useState<DiscountType>('NONE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceivedStr, setCashReceivedStr] = useState<string>('500');
  const [ewalletRef, setEwalletRef] = useState<string>('GC-20261112-901');
  const [receiptOrder, setReceiptOrder] = useState<SalesOrder | null>(null);
  const [returnModalOrder, setReturnModalOrder] = useState<SalesOrder | null>(null);
  const [returnReason, setReturnReason] = useState('Customer requested order cancellation');

  const posProducts = useMemo(() => {
    return products
      .filter((p) => p.sellable_on_pos && p.status === 'ACTIVE')
      .filter((p) => {
        if (selectedCategory !== 'All Products' && p.category_name !== selectedCategory) {
          return false;
        }
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          return (
            p.product_name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category_name.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [products, selectedCategory, search]);

  const totals = useMemo(
    () => calculateOrderTotals(cart, products, discountType),
    [cart, products, discountType]
  );

  const cashReceivedNum = Number(cashReceivedStr) || 0;
  const changeDue = Math.max(0, cashReceivedNum - totals.totalAmount);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      pushToast({
        type: 'warning',
        title: 'Cart is empty',
        description: 'Tap a menu item to start an order.',
      });
      return;
    }

    if (paymentMethod === 'CASH' && cashReceivedNum < totals.totalAmount) {
      pushToast({
        type: 'error',
        title: 'Insufficient cash tendered',
        description: `Need at least ${formatPeso(totals.totalAmount, totals.totalAmount % 1 !== 0)}.`,
      });
      return;
    }

    const res = completeSale({
      discountType,
      paymentMethod,
      amountTendered:
        paymentMethod === 'CASH' ? cashReceivedNum : totals.totalAmount,
      ewalletRef,
    });

    if (res.ok && res.order) {
      setReceiptOrder(res.order);
      setDiscountType('NONE');
      setCashReceivedStr('500');
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation bar: Counter vs Current Shift Returns/Voids */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#E8ECF2] bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setMode('counter')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
              mode === 'counter'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            POS Counter
          </button>
          <button
            type="button"
            onClick={() => setMode('history')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
              mode === 'history'
                ? 'bg-[#1E325C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Shift Transactions &amp; Returns ({orders.length})
          </button>
        </div>

        <p className="text-xs text-[#6B7280]">
          Oldest stock used first automatically · Cash &amp; E-Wallet accepted
        </p>
      </div>

      {mode === 'counter' ? (
        <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Product Catalog */}
          <div className="space-y-4 lg:col-span-8">
            {/* Search input */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                aria-label="Search POS products"
                className="w-full rounded-xl border border-[#E8ECF2] bg-white py-3 pr-4 pl-11 text-sm text-[#111827] placeholder-[#9CA3AF] shadow-xs focus:border-[#1E325C] focus:outline-none"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {POS_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#1E325C] bg-[#1E325C] font-semibold text-white'
                        : 'border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Product Card Grid */}
            {posProducts.length === 0 ? (
              <div className="acalen-card p-10 text-center text-sm text-[#6B7280]">
                No menu items match &ldquo;{search}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {posProducts.map((product) => {
                  const avail = getProductStock(batches, product.product_id);
                  const outOfStock = avail <= 0;
                  const activePrice = product.markdown_price ?? product.selling_price;
                  const inCart =
                    cart.find((c) => c.product_id === product.product_id)?.quantity ?? 0;

                  return (
                    <div
                      key={product.product_id}
                      onClick={() => !outOfStock && addToCart(product.product_id)}
                      role="button"
                      tabIndex={outOfStock ? -1 : 0}
                      aria-disabled={outOfStock}
                      onKeyDown={(e) => {
                        if (!outOfStock && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          addToCart(product.product_id);
                        }
                      }}
                      className={`acalen-card group flex flex-col justify-between overflow-hidden p-3.5 transition-all ${
                        outOfStock
                          ? 'cursor-not-allowed opacity-65'
                          : 'cursor-pointer hover:border-[#C5D2E3] hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#F1F5F9]">
                          <img
                            src={product.image_url ?? './images/ucc-coffee.png'}
                            alt={product.product_name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                          {product.markdown_price && (
                            <span className="absolute top-2 left-2 rounded-md bg-[#FFF8EB] px-2 py-0.5 text-[10px] font-semibold text-[#B4690E] shadow-xs">
                              Near-Expiry Promo
                            </span>
                          )}
                          <span
                            className={`absolute right-2 bottom-2 rounded-md px-2 py-0.5 text-[10px] font-semibold shadow-xs tabular-nums ${
                              outOfStock
                                ? 'bg-[#FEF2F2] text-[#C53030]'
                                : avail <= 10
                                  ? 'bg-[#FFF8EB] text-[#B4690E]'
                                  : 'bg-white/95 text-[#374151]'
                            }`}
                          >
                            {outOfStock ? 'Out of Stock' : `${avail} left`}
                          </span>
                          {inCart > 0 && (
                            <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1E325C] px-1.5 text-[11px] font-bold text-white shadow-sm tabular-nums">
                              {inCart}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-sm font-semibold text-[#111827]">
                          {product.product_name}
                        </h3>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-[#111827] tabular-nums">
                            {formatPeso(activePrice)}
                          </span>
                          {product.markdown_price && (
                            <span className="text-xs text-[#9CA3AF] line-through tabular-nums">
                              {formatPeso(product.selling_price)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product.product_id);
                          }}
                          aria-label={`Add ${product.product_name} to order`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C] hover:bg-[#1E325C] hover:text-white disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sticky Current Order Panel (Matching Figma Image 5) */}
          <div className="lg:col-span-4">
            <div className="acalen-card sticky top-24 flex flex-col p-5">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3.5">
                <h2 className="text-base font-bold text-[#111827]">Current Order</h2>
                <span className="text-xs font-medium text-[#6B7280] tabular-nums">
                  {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Cart Items */}
              <div className="my-4 max-h-[260px] space-y-3.5 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9CA3AF]">
                    No items selected. Tap a product card to add it to the order.
                  </div>
                ) : (
                  cart.map((item) => {
                    const product = products.find(
                      (p) => p.product_id === item.product_id
                    );
                    if (!product) return null;
                    const unitPrice = product.markdown_price ?? product.selling_price;
                    return (
                      <div
                        key={item.product_id}
                        className="flex items-start justify-between gap-3 border-b border-[#F8FAFC] pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#111827]">
                            {product.product_name}
                          </p>
                          <p className="text-xs text-[#6B7280] tabular-nums">
                            {formatPeso(unitPrice)} each
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-sm font-bold text-[#111827] tabular-nums">
                            {formatPeso(unitPrice * item.quantity)}
                          </span>
                          <div className="inline-flex items-center rounded-lg border border-[#E8ECF2] bg-[#F9FAFB]">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQty(item.product_id, item.quantity - 1)
                              }
                              aria-label={`Decrease ${product.product_name}`}
                              className="p-1.5 text-[#4B5563] hover:text-[#111827]"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-6 text-center text-xs font-semibold text-[#111827] tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQty(item.product_id, item.quantity + 1)
                              }
                              aria-label={`Increase ${product.product_name}`}
                              className="p-1.5 text-[#4B5563] hover:text-[#111827]"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Totals & Government-Mandated Discount Selector */}
              <div className="space-y-2.5 border-t border-[#E8ECF2] pt-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="pos-discount"
                    className="font-medium text-[#6B7280]"
                  >
                    Discount Type
                  </label>
                  <select
                    id="pos-discount"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] focus:border-[#1E325C] focus:outline-none"
                  >
                    <option value="NONE">Regular (No Discount)</option>
                    <option value="SENIOR_CITIZEN">
                      Senior Citizen (20% + VAT Exempt)
                    </option>
                    <option value="PWD">PWD (20% + VAT Exempt)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#111827] tabular-nums">
                    {formatPeso(totals.subtotal, totals.subtotal % 1 !== 0)}
                  </span>
                </div>

                {discountType !== 'NONE' && (
                  <div className="flex items-center justify-between text-[#6B7280]">
                    <span>Less 12% VAT Exemption</span>
                    <span className="font-medium text-[#15803D] tabular-nums">
                      -{formatPeso(totals.vatExemptDeduction, true)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[#6B7280]">
                  <span>Discount</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      totals.discountAmount > 0 ? 'text-[#15803D]' : 'text-[#111827]'
                    }`}
                  >
                    {totals.discountAmount > 0
                      ? `-${formatPeso(totals.discountAmount, true)}`
                      : '₱0'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F4F6FA] px-3.5 py-3">
                  <span className="text-sm font-bold text-[#111827]">Total</span>
                  <span className="text-xl font-bold text-[#1E325C] tabular-nums">
                    {formatPeso(totals.totalAmount, totals.totalAmount % 1 !== 0)}
                  </span>
                </div>
              </div>

              {/* Payment Method & Tender */}
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="pos-payment-method"
                    className="mb-1.5 block text-xs font-semibold text-[#374151]"
                  >
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold ${
                        paymentMethod === 'CASH'
                          ? 'border-[#1E325C] bg-[#EFF3F9] text-[#1E325C]'
                          : 'border-[#E2E8F0] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('E_WALLET')}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold ${
                        paymentMethod === 'E_WALLET'
                          ? 'border-[#1E325C] bg-[#EFF3F9] text-[#1E325C]'
                          : 'border-[#E2E8F0] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      E-Wallet
                    </button>
                  </div>
                </div>

                {paymentMethod === 'CASH' ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="pos-cash-received"
                        className="mb-1.5 block text-xs font-semibold text-[#374151]"
                      >
                        Cash Received
                      </label>
                      <div className="mb-1.5 flex gap-1">
                        {[
                          {
                            label: 'Exact',
                            val: String(Math.ceil(totals.totalAmount)),
                          },
                          { label: '₱200', val: '200' },
                          { label: '₱500', val: '500' },
                          { label: '₱1k', val: '1000' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setCashReceivedStr(chip.val)}
                            className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-medium text-[#475569] hover:border-[#1E325C] hover:text-[#1E325C]"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-semibold text-[#9CA3AF]">
                        ₱
                      </span>
                      <input
                        id="pos-cash-received"
                        type="number"
                        min={0}
                        step="1"
                        value={cashReceivedStr}
                        onChange={(e) => setCashReceivedStr(e.target.value)}
                        className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pr-3 pl-7 text-right text-sm font-semibold text-[#111827] tabular-nums focus:border-[#1E325C] focus:outline-none"
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="text-[#6B7280]">Change Due</span>
                      <span className="text-sm font-bold text-[#1E325C] tabular-nums">
                        {formatPeso(changeDue, changeDue % 1 !== 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="pos-ewallet-ref"
                      className="mb-1.5 block text-xs font-semibold text-[#374151]"
                    >
                      E-Wallet Reference (GCash / Maya)
                    </label>
                    <input
                      id="pos-ewallet-ref"
                      type="text"
                      value={ewalletRef}
                      onChange={(e) => setEwalletRef(e.target.value)}
                      placeholder="e.g. GC-88421094"
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#111827] focus:border-[#1E325C] focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-5 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="col-span-2 rounded-lg border border-[#E2E8F0] bg-white py-2.5 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                  >
                    Clear Order
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="col-span-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1E325C] py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#162647] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Complete Sale
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Shift Transactions & Returns View */
        <div className="no-print acalen-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8ECF2] px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                Current Shift Sales &amp; Returns
              </h2>
              <p className="text-xs text-[#6B7280]">
                Voiding an order or logging a return automatically restores deducted FEFO
                batch stock.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase">
                <tr>
                  <th className="px-6 py-3">Receipt #</th>
                  <th className="px-4 py-3">Items &amp; Batches</th>
                  <th className="px-4 py-3">Payment / Discount</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3.5">
                      <p className="font-mono font-semibold text-[#111827]">
                        {order.receipt_no}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {order.cashier_name}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {order.items.map((it) => (
                          <p key={it.item_id} className="text-[#374151]">
                            {it.quantity}× {it.product_name}{' '}
                            <span className="font-mono text-[10px] text-[#9CA3AF]">
                              ({it.batch_number})
                            </span>
                            {it.returned_qty > 0 && (
                              <span className="ml-1.5 text-[10px] font-semibold text-[#B4690E]">
                                · {it.returned_qty} returned
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#4B5563]">
                      <p className="font-medium">
                        {order.payment_method === 'CASH' ? 'Cash' : `E-Wallet (${order.ewallet_ref ?? ''})`}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {order.discount_type === 'NONE'
                          ? 'Regular'
                          : order.discount_type === 'SENIOR_CITIZEN'
                            ? 'Senior Citizen 20%'
                            : 'PWD 20%'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#111827] tabular-nums">
                      {formatPeso(order.total_amount, order.total_amount % 1 !== 0)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          order.status === 'COMPLETED'
                            ? 'bg-[#ECFDF3] text-[#15803D]'
                            : order.status === 'VOIDED'
                              ? 'bg-[#FEF2F2] text-[#C53030]'
                              : 'bg-[#FFF8EB] text-[#B4690E]'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReceiptOrder(order)}
                          className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6]"
                        >
                          Receipt
                        </button>
                        {order.status !== 'VOIDED' && (
                          <button
                            type="button"
                            onClick={() => setReturnModalOrder(order)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-semibold text-[#C53030] hover:bg-[#FEE2E2]"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Return / Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-title"
        >
          <div className="print-only-receipt w-full max-w-sm rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="no-print mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1E325C]">
                Browser Receipt Preview
              </span>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                aria-label="Close receipt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-dashed border-[#CBD5E1] pb-3 text-center">
              <h2 id="receipt-title" className="text-base font-bold text-[#111827]">
                WAXI&apos;S CAFE
              </h2>
              <p className="text-[11px] text-[#6B7280]">
                SND Foods International Inc. · JMC Airport Rd, Davao City
              </p>
              <p className="mt-1 font-mono text-[11px] font-semibold text-[#1E325C]">
                {receiptOrder.receipt_no}
              </p>
              <p className="text-[10px] text-[#6B7280]">
                {new Date(receiptOrder.created_at).toLocaleString()} · Cashier:{' '}
                {receiptOrder.cashier_name}
              </p>
            </div>

            <div className="my-3 space-y-2 border-b border-dashed border-[#CBD5E1] pb-3 text-xs">
              {receiptOrder.items.map((item) => (
                <div key={item.item_id} className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#111827]">
                      {item.quantity}× {item.product_name}
                    </p>
                    <p className="font-mono text-[10px] text-[#6B7280]">
                      Batch {item.batch_number} @ {formatPeso(item.unit_price)}
                    </p>
                  </div>
                  <span className="font-semibold text-[#111827] tabular-nums">
                    {formatPeso(item.quantity * item.unit_price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#4B5563]">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatPeso(receiptOrder.subtotal, true)}
                </span>
              </div>
              {receiptOrder.vat_exempt_deduction > 0 && (
                <div className="flex justify-between text-[#15803D]">
                  <span>Less 12% VAT Exempt</span>
                  <span className="tabular-nums">
                    -{formatPeso(receiptOrder.vat_exempt_deduction, true)}
                  </span>
                </div>
              )}
              {receiptOrder.discount_amount > 0 && (
                <div className="flex justify-between text-[#15803D]">
                  <span>{receiptOrder.discount_type} 20%</span>
                  <span className="tabular-nums">
                    -{formatPeso(receiptOrder.discount_amount, true)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-bold text-[#111827]">
                <span>TOTAL DUE</span>
                <span className="tabular-nums">
                  {formatPeso(receiptOrder.total_amount, true)}
                </span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>
                  {receiptOrder.payment_method === 'CASH'
                    ? 'Cash Tendered'
                    : `E-Wallet (${receiptOrder.ewallet_ref ?? ''})`}
                </span>
                <span className="tabular-nums">
                  {formatPeso(receiptOrder.amount_tendered, true)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-[#1E325C]">
                <span>Change Due</span>
                <span className="tabular-nums">
                  {formatPeso(receiptOrder.change_due, true)}
                </span>
              </div>
            </div>

            <p className="mt-3 text-center text-[10px] text-[#6B7280]">
              Thank you for visiting Waxi&apos;s Cafe! Powered by ACALEN POS.
            </p>

            <div className="no-print mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D1D5DB] py-2 text-xs font-semibold text-[#111827] hover:bg-[#F3F4F6]"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="flex-1 rounded-lg bg-[#1E325C] py-2 text-xs font-semibold text-white hover:bg-[#162647]"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return / Void Order Modal */}
      {returnModalOrder && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="return-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2
                id="return-modal-title"
                className="text-base font-semibold text-[#111827]"
              >
                Return / Void {returnModalOrder.receipt_no}
              </h2>
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151]">
                  Reason for Return / Void
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-xs focus:border-[#1E325C] focus:outline-none"
                />
              </div>

              <div className="space-y-2 rounded-xl border border-[#E8ECF2] bg-[#F9FAFB] p-3">
                <p className="text-[11px] font-semibold text-[#4B5563]">
                  Individual Item Return (Restores FEFO Batch)
                </p>
                {returnModalOrder.items.map((item) => {
                  const canReturn = item.quantity - item.returned_qty > 0;
                  return (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span>
                        {item.product_name} ({item.quantity - item.returned_qty} left ·{' '}
                        <span className="font-mono text-[10px] text-[#6B7280]">
                          {item.batch_number}
                        </span>
                        )
                      </span>
                      <button
                        type="button"
                        disabled={!canReturn}
                        onClick={() => {
                          processReturnOrVoid({
                            orderId: returnModalOrder.order_id,
                            mode: 'RETURN_ITEM',
                            itemId: item.item_id,
                            returnQty: 1,
                            reason: returnReason,
                          });
                          setReturnModalOrder(null);
                        }}
                        className="rounded-md border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#111827] hover:bg-[#F3F4F6] disabled:opacity-40"
                      >
                        Return 1
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    processReturnOrVoid({
                      orderId: returnModalOrder.order_id,
                      mode: 'VOID_ORDER',
                      reason: returnReason,
                    });
                    setReturnModalOrder(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#C53030] px-4 py-2 text-xs font-semibold text-white hover:bg-[#9B2C2C]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Void Full Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
