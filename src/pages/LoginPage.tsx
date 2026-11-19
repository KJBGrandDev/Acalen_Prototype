import React, { useState } from 'react';
import {
  AlertCircle,
  Coffee,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
  X,
} from 'lucide-react';
import { useAcalen } from '../context/AcalenContext';

export const LoginPage: React.FC = () => {
  const { login, pushToast } = useAcalen();

  const [username, setUsername] = useState('manager@waxiscafe.ph');
  const [password, setPassword] = useState('acalen2026');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both your username and password.');
      return;
    }
    const res = login(username, password);
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Invalid credentials.');
    } else {
      setErrorMsg(null);
    }
  };

  const quickFillAndLogin = (role: 'MANAGER' | 'CASHIER') => {
    const u = role === 'MANAGER' ? 'manager@waxiscafe.ph' : 'cashier@waxiscafe.ph';
    const p = role === 'MANAGER' ? 'acalen2026' : 'cashier2026';
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
    login(u, p);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoverySent(true);
    pushToast({
      type: 'info',
      title: 'Recovery instructions queued',
      description: `Reset link simulated for ${recoveryEmail.trim()}.`,
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8FA] px-4 py-10">
      {/* Main Login Card matching Figma Image 6 */}
      <div className="w-full max-w-[400px] rounded-2xl border border-[#E8ECF2] bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF3F9] text-[#1E325C]">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#111827]">
            Waxi&apos;s Cafe
          </h1>
          <p className="mt-1 text-xs font-medium text-[#6B7280]">
            ACALEN System Login
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          <div>
            <label
              htmlFor="login-username"
              className="mb-1.5 block text-xs font-medium text-[#374151]"
            >
              Username
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                id="login-username"
                type="email"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="username@example.com"
                autoComplete="username"
                className={`w-full rounded-lg border bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none ${
                  errorMsg
                    ? 'border-[#EF4444] ring-1 ring-[#EF4444]/30'
                    : 'border-[#CBD5E1] focus:border-[#1E325C] focus:ring-2 focus:ring-[#1E325C]/15'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-medium text-[#374151]"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full rounded-lg border bg-white py-2.5 pr-10 pl-10 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none ${
                  errorMsg
                    ? 'border-[#EF4444] ring-1 ring-[#EF4444]/30'
                    : 'border-[#E2E8F0] focus:border-[#1E325C] focus:ring-2 focus:ring-[#1E325C]/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-[#9CA3AF] hover:text-[#4B5563]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-xs text-[#C53030]"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#1E325C] py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#162647]"
          >
            Log In
          </button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setRecoverySent(false);
                setRecoveryEmail(username);
                setForgotOpen(true);
              }}
              className="text-xs font-medium text-[#1E325C] hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </form>
      </div>

      {/* Demo Quick-Access Bar for Manuscript Presentation */}
      <div className="mt-5 w-full max-w-[400px] rounded-xl border border-[#E8ECF2] bg-white/90 p-4 shadow-xs">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#6B7280]">
          <span>QUICK DEMO ACCESS (RBAC ROLES)</span>
          <span className="rounded bg-[#EFF3F9] px-1.5 py-0.5 text-[10px] text-[#1E325C]">
            SIA 1 Prototype
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => quickFillAndLogin('MANAGER')}
            className="rounded-lg border border-[#D8E1EE] bg-[#F8FAFC] px-3 py-2 text-left hover:border-[#1E325C] hover:bg-[#EFF3F9]"
          >
            <p className="text-xs font-semibold text-[#1E325C]">Manager Login</p>
            <p className="mt-0.5 truncate text-[10px] text-[#6B7280]">
              manager@waxiscafe.ph
            </p>
          </button>
          <button
            type="button"
            onClick={() => quickFillAndLogin('CASHIER')}
            className="rounded-lg border border-[#D8E1EE] bg-[#F8FAFC] px-3 py-2 text-left hover:border-[#1E325C] hover:bg-[#EFF3F9]"
          >
            <p className="text-xs font-semibold text-[#1E325C]">Cashier Login</p>
            <p className="mt-0.5 truncate text-[10px] text-[#6B7280]">
              cashier@waxiscafe.ph
            </p>
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#E8ECF2] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF3F9] text-[#1E325C]">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h2 id="forgot-title" className="text-sm font-semibold text-[#111827]">
                  Account Recovery
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {recoverySent ? (
              <div className="mt-4 space-y-4">
                <p className="rounded-lg bg-[#ECFDF3] p-3 text-xs leading-relaxed text-[#15803D]">
                  If an account matches <strong>{recoveryEmail}</strong>, the system
                  administrator (Manager) can reset the password via User Management.
                </p>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full rounded-lg bg-[#1E325C] py-2 text-xs font-semibold text-white hover:bg-[#162647]"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="mt-4 space-y-4">
                <p className="text-xs leading-relaxed text-[#6B7280]">
                  Enter your registered Waxi&apos;s Cafe account email to request a
                  password reset from your branch manager.
                </p>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="staff@waxiscafe.ph"
                    className="w-full rounded-lg border border-[#D1D5DB] py-2 pr-3 pl-9 text-xs focus:border-[#1E325C] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#1E325C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#162647]"
                  >
                    Send Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
