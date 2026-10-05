import React, { useState } from 'react';
import { Building2, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, FileText, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface LoginViewProps {
  onOpenPublicInvoice?: (identifier: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onOpenPublicInvoice }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [publicSearchNo, setPublicSearchNo] = useState('');
  const [activeTab, setActiveTab] = useState<'admin' | 'public'>('admin');

  const handlePublicSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const val = publicSearchNo.trim();
    if (!val) return;
    if (onOpenPublicInvoice) {
      onOpenPublicInvoice(val);
    } else {
      window.location.href = `/?inv=${encodeURIComponent(val)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Harap isi username/email dan password');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const res = await login(username.trim(), password);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Login gagal. Periksa kembali kredensial Anda');
    }
  };

  return (
    <div className="min-h-screen bg-[#07170e] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden selection:bg-[#136239] selection:text-white">
      {/* Background emerald glow effects matching dashboard branding */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#136239]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#7ba892]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-900/20 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#136239] text-white shadow-xl shadow-emerald-950/50 mb-3 ring-8 ring-emerald-500/10">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Info Papandayan
          </h1>
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">
            Sistem Invoice & Logistik Terpadu
          </p>
          <p className="text-slate-400 text-xs mt-1 font-medium">
            Masuk ke panel kendali manajemen bisnis & faktur resmi
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0e2417]/90 backdrop-blur-xl border border-emerald-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40 space-y-5">
          {/* View Mode Toggle */}
          <div className="flex bg-[#07170e] p-1 rounded-xl border border-emerald-900/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#136239] text-white shadow-sm'
                  : 'text-emerald-400/80 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login Admin / Staf</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('public')}
              className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'public'
                  ? 'bg-[#136239] text-white shadow-sm'
                  : 'text-emerald-400/80 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cek Faktur (Konsumen)</span>
            </button>
          </div>

          {activeTab === 'public' ? (
            /* Customer Direct Invoice Lookup (NO LOGIN REQUIRED) */
            <form onSubmit={handlePublicSearch} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs space-y-1">
                <span className="font-bold text-emerald-300 block">
                  Akses Terbuka Pelanggan — Tanpa Login
                </span>
                <p className="text-emerald-400/80 leading-relaxed text-[11px]">
                  Bagi pelanggan yang menerima link atau nomor faktur dari WhatsApp, silakan masukkan nomor faktur di bawah untuk melihat rincian dan mengunduh PDF resmi secara langsung tanpa login admin.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-200/90 uppercase tracking-wider mb-1.5">
                  Nomor Faktur Invoice / ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-500/70">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={publicSearchNo}
                    onChange={(e) => setPublicSearchNo(e.target.value)}
                    placeholder="Contoh: INV/2026/10/0001 atau 1"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#08170e]/90 border border-emerald-900/80 rounded-xl text-white placeholder-emerald-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#136239] transition font-mono"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] active:bg-[#0b3820] text-white font-bold text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-600/30"
              >
                <span>Buka & Unduh Faktur Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Admin / Staff Login Form */
            <>
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-200/90 uppercase tracking-wider mb-1.5">
                    Username / Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-500/70">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Contoh: admin atau admin@invoicemanager.id"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#08170e]/90 border border-emerald-900/80 rounded-xl text-white placeholder-emerald-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#136239] focus:border-[#7ba892] transition"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-200/90 uppercase tracking-wider mb-1.5">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-500/70">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi akun"
                      className="w-full pl-10 pr-11 py-2.5 bg-[#08170e]/90 border border-emerald-900/80 rounded-xl text-white placeholder-emerald-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#136239] focus:border-[#7ba892] transition"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-emerald-500/70 hover:text-emerald-300 transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] active:bg-[#0b3820] text-white font-bold text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-emerald-600/30"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick login demo buttons for multi-device testing */}
                <div className="pt-2 border-t border-emerald-900/60">
                  <p className="text-[11px] text-emerald-400/80 mb-2 font-medium text-center">
                    Akses Cepat Pengujian di Perangkat Ini:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUsername('admin');
                        setPassword('admin123');
                      }}
                      className="py-1.5 px-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 rounded-lg text-emerald-200 text-xs font-semibold transition text-center cursor-pointer"
                    >
                      ⚡ Isi Akun Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsername('staff');
                        setPassword('staff123');
                      }}
                      className="py-1.5 px-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 rounded-lg text-emerald-200 text-xs font-semibold transition text-center cursor-pointer"
                    >
                      ⚡ Isi Akun Staf
                    </button>
                  </div>
                </div>

                {/* Cloud status badge */}
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 text-[11px] text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span>Cloud Firestore Aktif — Data tersimpan aman & sinkron di semua device</span>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Security badge footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-emerald-500/70 flex items-center justify-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            Keamanan berbasis Session JWT & Password Hash Bcrypt
          </p>
        </div>
      </div>
    </div>
  );
};
