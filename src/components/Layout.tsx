import React, { useState } from 'react';
import {
  Box,
  ChevronDown,
  ClipboardList,
  Code2,
  Coffee,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';
import { NavTab } from '../types/acalen';
import { AcalenPipelineModal } from './AcalenPipelineModal';
import { AuditLogModal } from './AuditLogModal';

interface LayoutProps {
  children: React.ReactNode;
}

const PAGE_HEADERS: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: "Daily operational snapshot, 7-day forecast & rule-based advisories",
  },
  pos: {
    title: 'Point-of-Sale',
    subtitle: 'Process customer purchases and manage sales transactions',
  },
  inventory: {
    title: 'Inventory Management',
    subtitle: 'Monitor stock levels, product batches, and inventory movements',
  },
  rules: {
    title: 'Business Rules & Thresholds',
    subtitle: 'Set stock alerts, profit goals, and expiry reminders in plain terms',
  },
  forecasts: {
    title: 'Demand Forecasting',
    subtitle: 'Analyze historical sales and predict future product demand',
  },
  reports: {
    title: 'Reports & Business Analysis',
    subtitle: 'Review sales, inventory and ACALEN decision-support results',
  },
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    logout,
    switchDemoRole,
    pendingRecommendationCount,
    resetDemoData,
    toasts,
    dismissToast,
  } = useAcalen();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineAutoRun, setPipelineAutoRun] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  if (!currentUser) return <>{children}</>;

  const isManager = currentUser.role_name === 'MANAGER';

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = isManager
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { id: 'pos', label: 'POS', icon: ShoppingCart },
        { id: 'inventory', label: 'Inventory', icon: Box },
        {
          id: 'rules',
          label: 'Rules',
          icon: SlidersHorizontal,
          badge: pendingRecommendationCount > 0 ? pendingRecommendationCount : undefined,
        },
        { id: 'forecasts', label: 'Forecasts', icon: TrendingUp },
        { id: 'reports', label: 'Reports', icon: FileText },
      ]
    : [{ id: 'pos', label: 'POS', icon: ShoppingCart }];

  const headerInfo = PAGE_HEADERS[activeTab] ?? PAGE_HEADERS.dashboard;

  const openPipeline = (autoRun: boolean) => {
    setPipelineAutoRun(autoRun);
    setPipelineOpen(true);
    setAccountMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-white">
      <div>
        {/* Brand Block */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-[#1E325C]">ACALEN</p>
            <p className="text-[11px] font-medium text-[#6B7280]">Waxi&apos;s Cafe</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="mt-2 space-y-1 px-3" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`relative flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#EFF3F9] font-semibold text-[#1E325C]'
                    : 'text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827]'
                }`}
              >
                {active && (
                  <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-[#1E325C]" />
                )}
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${active ? 'text-[#1E325C]' : 'text-[#6B7280]'}`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-[#1E325C] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Info */}
      <div className="border-t border-[#E8ECF2] p-4">
        <div className="rounded-xl bg-[#F8FAFC] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1E325C]">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{isManager ? 'Manager Access' : 'Cashier Mode (POS Only)'}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">
            {isManager
              ? 'Full inventory, forecasting, rules & decision-support permissions.'
              : 'Counter sales only — product costs, settings, and reports are hidden.'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F8FA] text-[#111827]">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden w-60 shrink-0 border-r border-[#E8ECF2] bg-white lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile/Tablet Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 border-r border-[#E8ECF2] bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 border-b border-[#E8ECF2] bg-[#F7F8FA]/95 px-4 py-4 backdrop-blur sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-[#E8ECF2] bg-white p-2 text-[#374151] hover:bg-[#F3F4F6] lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                  {headerInfo.title}
                </h1>
                <p className="text-xs text-[#6B7280] sm:text-[13px]">
                  {headerInfo.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {isManager &&
                (activeTab === 'dashboard' ||
                  activeTab === 'forecasts' ||
                  activeTab === 'rules') && (
                  <button
                    type="button"
                    onClick={() => openPipeline(true)}
                    className="hidden items-center gap-2 rounded-lg border border-[#D8E1EE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E325C] shadow-xs hover:bg-[#EFF3F9] sm:inline-flex"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Run Acalen Analysis
                  </button>
                )}

              {/* User Role / Account Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-2.5 rounded-full border border-[#E8ECF2] bg-white py-1.5 pr-3 pl-2 text-xs font-medium text-[#111827] shadow-xs hover:bg-[#F9FAFB]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EFF3F9] text-[#1E325C]">
                    <UserCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block font-semibold leading-tight text-[#111827]">
                      {isManager ? 'Manager' : 'Cashier'}
                    </span>
                    <span className="block text-[10px] text-[#6B7280]">
                      {currentUser.full_name}
                    </span>
                  </span>
                  <span className="sm:hidden">
                    {isManager ? 'Manager' : 'Cashier'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#6B7280]" />
                </button>

                {accountMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setAccountMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-[#E8ECF2] bg-white p-1.5 shadow-xl">
                      <div className="border-b border-[#F1F5F9] px-3 py-2">
                        <p className="text-xs font-semibold text-[#111827]">
                          {currentUser.full_name}
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {currentUser.username} · {currentUser.role_name}
                        </p>
                      </div>

                      <div className="py-1">
                        <p className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[#9CA3AF] uppercase">
                          Demo Role Switcher (RBAC)
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            switchDemoRole('MANAGER');
                            setAccountMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${
                            isManager
                              ? 'bg-[#EFF3F9] font-semibold text-[#1E325C]'
                              : 'text-[#374151] hover:bg-[#F3F4F6]'
                          }`}
                        >
                          <span>Switch to Manager</span>
                          {isManager && <span className="text-[10px]">Active</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            switchDemoRole('CASHIER');
                            setAccountMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${
                            !isManager
                              ? 'bg-[#EFF3F9] font-semibold text-[#1E325C]'
                              : 'text-[#374151] hover:bg-[#F3F4F6]'
                          }`}
                        >
                          <span>Switch to Cashier</span>
                          {!isManager && <span className="text-[10px]">Active</span>}
                        </button>
                      </div>

                      <div className="border-t border-[#F1F5F9] py-1">
                        {isManager && (
                          <>
                            <button
                              type="button"
                              onClick={() => openPipeline(false)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F3F4F6]"
                            >
                              <Code2 className="h-3.5 w-3.5 text-[#1E325C]" />
                              Inspect Engine Contract JSON
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAccountMenuOpen(false);
                                setAuditOpen(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F3F4F6]"
                            >
                              <ClipboardList className="h-3.5 w-3.5 text-[#1E325C]" />
                              Activity History
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            resetDemoData();
                            setAccountMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F3F4F6]"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-[#6B7280]" />
                          Reset Demo Data
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#C53030] hover:bg-[#FEF2F2]"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Log Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 sm:px-7">{children}</main>
      </div>

      {/* Toast Notifications */}
      <div
        className="no-print pointer-events-none fixed top-20 right-5 z-50 flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const accent =
            toast.type === 'success'
              ? 'border-l-[#22C55E]'
              : toast.type === 'warning'
                ? 'border-l-[#D97706]'
                : toast.type === 'error'
                  ? 'border-l-[#EF4444]'
                  : 'border-l-[#1E325C]';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-[#E8ECF2] border-l-4 ${accent} bg-white p-3.5 shadow-lg`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#111827]">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-[11px] text-[#6B7280]">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded p-0.5 text-[#9CA3AF] hover:text-[#374151]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <AcalenPipelineModal
        open={pipelineOpen}
        onClose={() => setPipelineOpen(false)}
        autoRun={pipelineAutoRun}
      />
      <AuditLogModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  );
};
