import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Box,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { CATEGORIES, REFERENCE_TODAY } from '../data/seedData';
import {
  daysBetween,
  formatDateShort,
  formatPeso,
  getEarliestActiveBatch,
  getExpiryStatus,
  getGrossMarginPct,
  getProductBatches,
  getProductStock,
  getStockStatus,
} from '../engine/acalenEngine';
import { StockStatusPill } from '../components/StatusBadge';
import { CategoryName, Product } from '../types/acalen';

const PAGE_SIZE = 6;

export const InventoryPage: React.FC = () => {
  const {
    products,
    batches,
    rules,
    stockMovements,
    addProduct,
    editProduct,
    recordStockIn,
    recordStockTransfer,
    recordWastage,
  } = useAcalen();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [viewProductId, setViewProductId] = useState<number | null>(null);
  const [editProductTarget, setEditProductTarget] = useState<Product | null>(null);
  const [activeModal, setActiveModal] = useState<
    null | 'add_product' | 'stock_in' | 'transfer' | 'wastage'
  >(null);

  // Enrich products with computed stock, safety stock, earliest batch & statuses
  const enriched = useMemo(() => {
    return products.map((product) => {
      const rule = rules.find((r) => r.product_id === product.product_id);
      const safetyStock = rule?.safety_stock ?? 10;
      const warnDays = rule?.expiry_warning_days ?? 7;
      const currentStock = getProductStock(batches, product.product_id);
      const earliestBatch = getEarliestActiveBatch(batches, product.product_id);
      const stockStatus = getStockStatus(currentStock, safetyStock);
      const expiryStatus = getExpiryStatus(
        earliestBatch?.expiration_date,
        warnDays,
        REFERENCE_TODAY
      );
      return {
        product,
        rule,
        safetyStock,
        currentStock,
        earliestBatch,
        stockStatus,
        expiryStatus,
      };
    });
  }, [products, batches, rules]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const lowStock = enriched.filter((e) => e.stockStatus === 'LOW_STOCK').length;
    const expiringSoon = enriched.filter(
      (e) =>
        e.currentStock > 0 &&
        (e.expiryStatus === 'EXPIRING_SOON' || e.expiryStatus === 'EXPIRED')
    ).length;
    const outOfStock = enriched.filter((e) => e.stockStatus === 'OUT_OF_STOCK').length;
    return { total, lowStock, expiringSoon, outOfStock };
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      if (catFilter !== 'ALL' && row.product.category_name !== catFilter) {
        return false;
      }
      if (stockFilter !== 'ALL' && row.stockStatus !== stockFilter) {
        return false;
      }
      if (expiryFilter !== 'ALL' && row.expiryStatus !== expiryFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          row.product.product_name.toLowerCase().includes(q) ||
          row.product.sku.toLowerCase().includes(q) ||
          (row.earliestBatch?.batch_number.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [enriched, catFilter, stockFilter, expiryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Add Product Form State
  const [newForm, setNewForm] = useState({
    product_name: '',
    sku: 'PRD-014',
    category_name: 'Pastries' as CategoryName,
    unit_label: 'pcs',
    unit_cost: '45',
    selling_price: '95',
    sellable_on_pos: true,
    supplier: 'Waxi Kitchen Bakehouse',
    initial_qty: '20',
    batch_number: 'BATCH-050',
    expiration_date: '2026-12-20',
    safety_stock: '10',
    reorder_level: '15',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Stock In Form
  const [stockInForm, setStockInForm] = useState({
    productId: String(products[0]?.product_id ?? 1),
    batchNumber: 'BATCH-051',
    qty: '15',
    unitCost: String(products[0]?.unit_cost ?? 850),
    expirationDate: '2026-12-30',
    reason: 'Supplier delivery restock',
  });

  // Transfer / Wastage Form
  const [movementForm, setMovementForm] = useState({
    productId: String(products[0]?.product_id ?? 1),
    batchId: '',
    qty: '2',
    destination: 'Main Espresso Bar',
    movementType: 'WASTAGE' as 'WASTAGE' | 'SHRINKAGE',
    reason: 'Expired or damaged stock disposal',
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    product_name: '',
    category_name: 'Coffee' as CategoryName,
    unit_label: 'pcs',
    unit_cost: '',
    selling_price: '',
    supplier: '',
    sellable_on_pos: true,
  });

  const openEditModal = (product: Product) => {
    setFormError(null);
    setEditProductTarget(product);
    setEditForm({
      product_name: product.product_name,
      category_name: product.category_name,
      unit_label: product.unit_label,
      unit_cost: String(product.unit_cost),
      selling_price: String(product.selling_price),
      supplier: product.supplier,
      sellable_on_pos: product.sellable_on_pos,
    });
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(newForm.unit_cost);
    const price = Number(newForm.selling_price);
    const qty = Number(newForm.initial_qty);
    const safety = Number(newForm.safety_stock);
    const reorder = Number(newForm.reorder_level);

    if (!newForm.product_name.trim() || !newForm.sku.trim()) {
      setFormError('Product name and SKU are required.');
      return;
    }
    if (cost <= 0 || price <= 0 || qty < 0 || safety < 0 || reorder < 0) {
      setFormError('Costs, prices, and stock thresholds must be valid positive numbers.');
      return;
    }
    if (!newForm.expiration_date) {
      setFormError('Expiration date is required for batch tracking.');
      return;
    }

    addProduct({
      product_name: newForm.product_name,
      sku: newForm.sku,
      category_name: newForm.category_name,
      unit_label: newForm.unit_label,
      unit_cost: cost,
      selling_price: price,
      sellable_on_pos: newForm.sellable_on_pos,
      supplier: newForm.supplier,
      initial_qty: qty,
      batch_number: newForm.batch_number,
      expiration_date: newForm.expiration_date,
      safety_stock: safety,
      reorder_level: reorder,
    });
    setFormError(null);
    setActiveModal(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProductTarget) return;
    const cost = Number(editForm.unit_cost);
    const price = Number(editForm.selling_price);
    if (!editForm.product_name.trim()) {
      setFormError('Product name cannot be empty.');
      return;
    }
    if (cost <= 0 || price <= 0) {
      setFormError('Unit cost and selling price must be greater than zero.');
      return;
    }
    editProduct(editProductTarget.product_id, {
      product_name: editForm.product_name.trim(),
      category_name: editForm.category_name,
      unit_label: editForm.unit_label,
      unit_cost: cost,
      selling_price: price,
      supplier: editForm.supplier.trim(),
      sellable_on_pos: editForm.sellable_on_pos,
    });
    setEditProductTarget(null);
    setFormError(null);
  };

  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(stockInForm.productId);
    const qty = Number(stockInForm.qty);
    const cost = Number(stockInForm.unitCost);
    if (qty <= 0 || cost <= 0 || !stockInForm.batchNumber.trim() || !stockInForm.expirationDate) {
      setFormError('Provide a valid batch number, positive quantity, cost, and expiry date.');
      return;
    }
    recordStockIn({
      productId: pid,
      batchNumber: stockInForm.batchNumber,
      qty,
      unitCost: cost,
      expirationDate: stockInForm.expirationDate,
      reason: stockInForm.reason,
    });
    setFormError(null);
    setActiveModal(null);
  };

  const selectedMovementBatches = useMemo(() => {
    return getProductBatches(batches, Number(movementForm.productId)).filter(
      (b) => b.qty_on_hand > 0
    );
  }, [batches, movementForm.productId]);

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(movementForm.productId);
    const batchId =
      Number(movementForm.batchId) || selectedMovementBatches[0]?.batch_id;
    const qty = Number(movementForm.qty);

    if (!batchId || qty <= 0) {
      setFormError('Select an active batch with available stock and a positive quantity.');
      return;
    }

    const res =
      activeModal === 'transfer'
        ? recordStockTransfer({
            productId: pid,
            batchId,
            qty,
            destination: movementForm.destination,
            reason: movementForm.reason,
          })
        : recordWastage({
            productId: pid,
            batchId,
            qty,
            movementType: movementForm.movementType,
            reason: movementForm.reason,
          });

    if (!res.ok) {
      setFormError(res.error ?? 'Unable to record stock movement.');
      return;
    }
    setFormError(null);
    setActiveModal(null);
  };

  const inspectedProduct = viewProductId
    ? enriched.find((e) => e.product.product_id === viewProductId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards matching Figma Image 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Total Products</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.total}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">Across all categories</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Low Stock Items</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.lowStock}
          </p>
          <p className="mt-1 text-xs font-medium text-[#B4690E]">Below safety stock</p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Expiring Soon</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8EB] text-[#D97706]">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.expiringSoon}
          </p>
          <p className="mt-1 text-xs font-medium text-[#B4690E]">
            Upcoming batch expirations
          </p>
        </div>

        <div className="acalen-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Out of Stock</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#C53030]">
              <Box className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-[#111827] tabular-nums">
            {kpis.outOfStock}
          </p>
          <p className="mt-1 text-xs font-medium text-[#C53030]">
            Replenishment needed
          </p>
        </div>
      </div>

      {/* Filters & Action Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product name, SKU, or batch..."
              aria-label="Search inventory records"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-4 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] shadow-xs focus:border-[#1E325C] focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.category_id} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by stock status"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={expiryFilter}
              onChange={(e) => {
                setExpiryFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by expiration status"
              className="w-full rounded-xl border border-[#E8ECF2] bg-white px-3 py-2.5 text-xs text-[#374151] shadow-xs focus:border-[#1E325C] focus:outline-none"
            >
              <option value="ALL">All Expiration Status</option>
              <option value="GOOD">Normal Shelf Life</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('add_product');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E325C] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#162647]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('stock_in');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8ECF2] bg-white px-4 py-2 text-xs font-semibold text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
          >
            <Download className="h-3.5 w-3.5 text-[#4B5563]" />
            Stock In
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('transfer');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8ECF2] bg-white px-4 py-2 text-xs font-semibold text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#4B5563]" />
            Stock Transfer
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveModal('wastage');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8ECF2] bg-white px-4 py-2 text-xs font-semibold text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
          >
            <Trash2 className="h-3.5 w-3.5 text-[#4B5563]" />
            Record Wastage
          </button>
        </div>
      </div>

      {/* Inventory Records Table */}
      <div className="acalen-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
          <h2 className="text-base font-semibold text-[#111827]">Inventory Records</h2>
          <span className="text-xs font-medium text-[#6B7280] tabular-nums">
            {filtered.length} products
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8ECF2] bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
              <tr>
                <th className="px-6 py-3.5">Product</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Current Stock</th>
                <th className="px-4 py-3.5">Safety Stock</th>
                <th className="px-4 py-3.5">Unit Cost</th>
                <th className="px-4 py-3.5">Batch/Expiration</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-[#6B7280]">
                    No inventory items match the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows.map(
                  ({
                    product,
                    safetyStock,
                    currentStock,
                    earliestBatch,
                    stockStatus,
                    expiryStatus,
                  }) => {
                    const stockColor =
                      stockStatus === 'OUT_OF_STOCK'
                        ? 'text-[#C53030]'
                        : stockStatus === 'LOW_STOCK'
                          ? 'text-[#B4690E]'
                          : 'text-[#111827]';
                    const expColor =
                      expiryStatus === 'EXPIRING_SOON' || expiryStatus === 'EXPIRED'
                        ? 'text-[#B4690E]'
                        : 'text-[#6B7280]';

                    return (
                      <tr key={product.product_id} className="hover:bg-[#F9FAFB]">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[#111827]">
                            {product.product_name}
                          </p>
                          <p className="font-mono text-[11px] text-[#9CA3AF]">
                            {product.sku}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[#4B5563]">
                          {product.category_name}
                        </td>
                        <td
                          className={`px-4 py-4 font-bold tabular-nums ${stockColor}`}
                        >
                          {currentStock} {product.unit_label}
                        </td>
                        <td className="px-4 py-4 text-[#6B7280] tabular-nums">
                          {safetyStock} {product.unit_label}
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#111827] tabular-nums">
                          {formatPeso(product.unit_cost, product.unit_cost % 1 !== 0)}
                        </td>
                        <td className="px-4 py-4">
                          {earliestBatch ? (
                            <>
                              <p className="font-mono font-medium text-[#111827]">
                                {earliestBatch.batch_number}
                              </p>
                              <p className={`text-[11px] ${expColor}`}>
                                {formatDateShort(earliestBatch.expiration_date)}
                              </p>
                            </>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StockStatusPill
                            stockStatus={stockStatus}
                            expiryStatus={expiryStatus}
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setViewProductId(product.product_id)}
                              className="inline-flex flex-col items-center gap-0.5 text-[11px] font-medium text-[#4B5563] hover:text-[#1E325C]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="inline-flex flex-col items-center gap-0.5 text-[11px] font-medium text-[#4B5563] hover:text-[#1E325C]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8ECF2] px-6 py-3.5 text-xs text-[#6B7280]">
          <p className="tabular-nums">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}{' '}
            products
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
                  p === safePage
                    ? 'bg-[#1E325C] text-white'
                    : 'border border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F3F4F6]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8ECF2] bg-white text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* View Product & Batches Drawer Modal */}
      {inspectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-product-title"
        >
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8ECF2] px-6 py-4">
              <div>
                <h2
                  id="view-product-title"
                  className="text-base font-semibold text-[#111827]"
                >
                  {inspectedProduct.product.product_name} ({inspectedProduct.product.sku})
                </h2>
                <p className="text-xs text-[#6B7280]">
                  {inspectedProduct.product.category_name} · Supplier:{' '}
                  {inspectedProduct.product.supplier}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewProductId(null)}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                aria-label="Close detail modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">Total On Hand</p>
                  <p className="mt-0.5 text-base font-bold text-[#111827] tabular-nums">
                    {inspectedProduct.currentStock}{' '}
                    {inspectedProduct.product.unit_label}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">Unit Cost</p>
                  <p className="mt-0.5 text-base font-bold text-[#111827] tabular-nums">
                    {formatPeso(inspectedProduct.product.unit_cost)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">Selling Price</p>
                  <p className="mt-0.5 text-base font-bold text-[#111827] tabular-nums">
                    {formatPeso(
                      inspectedProduct.product.markdown_price ??
                        inspectedProduct.product.selling_price
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8ECF2] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] text-[#6B7280]">Gross Margin</p>
                  <p className="mt-0.5 text-base font-bold text-[#1E325C] tabular-nums">
                    {getGrossMarginPct(
                      inspectedProduct.product.unit_cost,
                      inspectedProduct.product.markdown_price ??
                        inspectedProduct.product.selling_price
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#374151] uppercase">
                  FEFO Batch Breakdown
                </h3>
                <div className="mt-2 overflow-hidden rounded-xl border border-[#E8ECF2]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F9FAFB] text-[11px] font-medium text-[#6B7280]">
                      <tr>
                        <th className="px-4 py-2.5">Batch #</th>
                        <th className="px-4 py-2.5">Qty On Hand</th>
                        <th className="px-4 py-2.5">Received</th>
                        <th className="px-4 py-2.5">Expiration Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {getProductBatches(
                        batches,
                        inspectedProduct.product.product_id
                      ).map((b) => {
                        const dLeft = daysBetween(REFERENCE_TODAY, b.expiration_date);
                        return (
                          <tr key={b.batch_id}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-[#111827]">
                              {b.batch_number}
                            </td>
                            <td className="px-4 py-2.5 font-bold tabular-nums">
                              {b.qty_on_hand} {inspectedProduct.product.unit_label}
                            </td>
                            <td className="px-4 py-2.5 text-[#6B7280]">
                              {formatDateShort(b.received_at)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={
                                  dLeft <= 7 ? 'font-medium text-[#B4690E]' : 'text-[#4B5563]'
                                }
                              >
                                {formatDateShort(b.expiration_date)} ({dLeft}d)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#374151] uppercase">
                  Recent Stock Movements
                </h3>
                <div className="mt-2 space-y-2">
                  {stockMovements
                    .filter((m) => m.product_id === inspectedProduct.product.product_id)
                    .slice(0, 6)
                    .map((m) => (
                      <div
                        key={m.movement_id}
                        className="flex items-center justify-between rounded-lg border border-[#E8ECF2] bg-[#F9FAFB] px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-medium text-[#111827]">
                            {m.movement_type} ·{' '}
                            <span className="font-mono text-[11px]">{m.batch_number}</span>
                          </p>
                          <p className="text-[11px] text-[#6B7280]">{m.reason}</p>
                        </div>
                        <span
                          className={`font-bold tabular-nums ${
                            m.quantity >= 0 ? 'text-[#15803D]' : 'text-[#C53030]'
                          }`}
                        >
                          {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}{' '}
                          {inspectedProduct.product.unit_label}
                        </span>
                      </div>
                    ))}
                  {stockMovements.filter(
                    (m) => m.product_id === inspectedProduct.product.product_id
                  ).length === 0 && (
                    <p className="text-xs text-[#9CA3AF]">
                      No recent movements logged for this SKU.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {activeModal === 'add_product' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="add-product-title" className="text-base font-semibold text-[#111827]">
                Add New Product &amp; Initial Batch
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddProductSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={newForm.product_name}
                    onChange={(e) =>
                      setNewForm({ ...newForm, product_name: e.target.value })
                    }
                    placeholder="e.g. Matcha Latte"
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">SKU</label>
                  <input
                    type="text"
                    value={newForm.sku}
                    onChange={(e) => setNewForm({ ...newForm, sku: e.target.value })}
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Category
                  </label>
                  <select
                    value={newForm.category_name}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        category_name: e.target.value as CategoryName,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.category_id} value={c.category_name}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newForm.unit_cost}
                    onChange={(e) =>
                      setNewForm({ ...newForm, unit_cost: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newForm.selling_price}
                    onChange={(e) =>
                      setNewForm({ ...newForm, selling_price: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Batch #
                  </label>
                  <input
                    type="text"
                    value={newForm.batch_number}
                    onChange={(e) =>
                      setNewForm({ ...newForm, batch_number: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Initial Qty
                  </label>
                  <input
                    type="number"
                    value={newForm.initial_qty}
                    onChange={(e) =>
                      setNewForm({ ...newForm, initial_qty: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={newForm.expiration_date}
                    onChange={(e) =>
                      setNewForm({ ...newForm, expiration_date: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">Unit</label>
                  <input
                    type="text"
                    value={newForm.unit_label}
                    onChange={(e) =>
                      setNewForm({ ...newForm, unit_label: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Safety Stock
                  </label>
                  <input
                    type="number"
                    value={newForm.safety_stock}
                    onChange={(e) =>
                      setNewForm({ ...newForm, safety_stock: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={newForm.reorder_level}
                    onChange={(e) =>
                      setNewForm({ ...newForm, reorder_level: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={newForm.sellable_on_pos}
                  onChange={(e) =>
                    setNewForm({ ...newForm, sellable_on_pos: e.target.checked })
                  }
                  className="rounded border-[#D1D5DB]"
                />
                <span className="text-[#374151]">Show as sellable menu item on POS</span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-product-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="edit-product-title" className="text-base font-semibold text-[#111827]">
                Edit {editProductTarget.product_name}
              </h2>
              <button
                type="button"
                onClick={() => setEditProductTarget(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Product Name
                </label>
                <input
                  type="text"
                  value={editForm.product_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, product_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.unit_cost}
                    onChange={(e) =>
                      setEditForm({ ...editForm, unit_cost: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.selling_price}
                    onChange={(e) =>
                      setEditForm({ ...editForm, selling_price: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Supplier
                </label>
                <input
                  type="text"
                  value={editForm.supplier}
                  onChange={(e) =>
                    setEditForm({ ...editForm, supplier: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditProductTarget(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In Modal */}
      {activeModal === 'stock_in' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-in-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="stock-in-title" className="text-base font-semibold text-[#111827]">
                Record Stock-In Delivery
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleStockInSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Product
                </label>
                <select
                  value={stockInForm.productId}
                  onChange={(e) => {
                    const p = products.find(
                      (x) => x.product_id === Number(e.target.value)
                    );
                    setStockInForm({
                      ...stockInForm,
                      productId: e.target.value,
                      unitCost: String(p?.unit_cost ?? 50),
                    });
                  }}
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                >
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={stockInForm.batchNumber}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, batchNumber: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Quantity Received
                  </label>
                  <input
                    type="number"
                    value={stockInForm.qty}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, qty: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Unit Cost (₱)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={stockInForm.unitCost}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, unitCost: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={stockInForm.expirationDate}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, expirationDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-2.5 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#374151]">Notes</label>
                <input
                  type="text"
                  value={stockInForm.reason}
                  onChange={(e) =>
                    setStockInForm({ ...stockInForm, reason: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Log Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer / Wastage Modal */}
      {(activeModal === 'transfer' || activeModal === 'wastage') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 id="movement-title" className="text-base font-semibold text-[#111827]">
                {activeModal === 'transfer'
                  ? 'Log Stock Transfer'
                  : 'Record Wastage / Shrinkage'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleMovementSubmit} className="mt-4 space-y-3 text-xs">
              {formError && (
                <p className="rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#C53030]">
                  {formError}
                </p>
              )}
              <div>
                <label className="mb-1 block font-medium text-[#374151]">
                  Product
                </label>
                <select
                  value={movementForm.productId}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    const nextBatches = getProductBatches(batches, pid).filter(
                      (b) => b.qty_on_hand > 0
                    );
                    setMovementForm({
                      ...movementForm,
                      productId: e.target.value,
                      batchId: String(nextBatches[0]?.batch_id ?? ''),
                    });
                  }}
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                >
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({getProductStock(batches, p.product_id)}{' '}
                      {p.unit_label})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Active Batch
                  </label>
                  <select
                    value={
                      movementForm.batchId ||
                      String(selectedMovementBatches[0]?.batch_id ?? '')
                    }
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, batchId: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-mono"
                  >
                    {selectedMovementBatches.length === 0 ? (
                      <option value="">No stock in batches</option>
                    ) : (
                      selectedMovementBatches.map((b) => (
                        <option key={b.batch_id} value={b.batch_id}>
                          {b.batch_number} ({b.qty_on_hand} avail)
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={movementForm.qty}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, qty: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 tabular-nums"
                  />
                </div>
              </div>

              {activeModal === 'transfer' ? (
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Destination Area
                  </label>
                  <input
                    type="text"
                    value={movementForm.destination}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, destination: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block font-medium text-[#374151]">
                    Loss Type
                  </label>
                  <select
                    value={movementForm.movementType}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        movementType: e.target.value as 'WASTAGE' | 'SHRINKAGE',
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                  >
                    <option value="WASTAGE">Wastage / Spoilage</option>
                    <option value="SHRINKAGE">Audit Shrinkage / Variance</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block font-medium text-[#374151]">Reason</label>
                <input
                  type="text"
                  value={movementForm.reason}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, reason: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E325C] px-4 py-2 font-semibold text-white hover:bg-[#162647]"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
