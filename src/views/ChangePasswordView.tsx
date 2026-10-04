import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Save,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export const ChangePasswordView: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Password saat ini wajib diisi');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password baru minimal harus 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password baru tidak cocok');
      return;
    }

    setLoading(true);
    const res = await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    setLoading(false);

    if (res.success) {
      toast.success(res.message || 'Password berhasil diperbarui!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error(res.message || 'Gagal mengubah password');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <KeyRound className="w-6 h-6 text-[#136239]" />
          <span>Ganti Password Akun</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Perbarui kata sandi login akun Anda untuk menjaga keamanan akses sistem administrasi & invoice
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Account Info Card */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-[#136239] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{user?.full_name || 'Admin'}</h3>
              <p className="text-xs font-mono text-slate-500">@{user?.username}</p>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Peran:</span>
                <span className="font-semibold text-slate-900 capitalize">
                  {user?.role_name === 'super_admin' ? 'Super Administrator' : 'Staff Admin'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Email:</span>
                <span className="font-medium text-slate-700 truncate max-w-[140px]">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-[#136239]">
              <Lock className="w-4 h-4 shrink-0" />
              Petunjuk Keamanan
            </p>
            <ul className="list-disc list-inside space-y-1 text-emerald-800/90 text-[11px] leading-relaxed">
              <li>Minimal 6 karakter atau lebih</li>
              <li>Gunakan kombinasi huruf kapital, angka, atau simbol</li>
              <li>Jangan bagikan password kepada pihak lain</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Form Card */}
        <div className="md:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5"
          >
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password Saat Ini *
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#136239] focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password Baru *
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#136239] focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {newPassword.length >= 6 ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Panjang mencukupi ({newPassword.length} karakter)
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Masih kurang {6 - newPassword.length} karakter
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Konfirmasi Password Baru *
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru yang diketik di atas"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#136239] focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && (
                <div className="mt-1.5 text-[11px]">
                  {newPassword === confirmPassword ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Password cocok
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Password belum cocok
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Menyimpan...' : 'Perbarui Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
