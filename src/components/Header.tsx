import React from 'react';
import { Menu, Plus, Building2, UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { NavTab } from './Sidebar.tsx';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  companyName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  currentTab,
  onNavigate,
  companyName = 'Info Papandayan',
}) => {
  const { user } = useAuth();

  const getPageTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard Ringkasan';
      case 'create-invoice':
        return 'Buat Invoice Baru';
      case 'invoices':
        return 'Daftar Invoice Transaksi';
      case 'products':
        return 'Manajemen Produk & Stok';
      case 'customers':
        return 'Manajemen Data Pelanggan';
      case 'reports':
        return 'Laporan Pengeluaran Barang';
      case 'settings':
        return 'Pengaturan Sistem & Perusahaan';
      case 'change-password':
        return 'Ganti Password Akun';
      case 'users':
        return 'Kelola Pengguna & Hak Akses';
      case 'logs':
        return 'Log Aktivitas Pengguna';
      default:
        return 'Sistem Invoice';
    }
  };

  return (
    <header className="h-18 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Buka navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {getPageTitle(currentTab)}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#136239]" />
              {companyName}
            </span>
            <span className="text-slate-300">•</span>
            <span>Versi Resmi</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentTab !== 'create-invoice' && (
          <button
            onClick={() => onNavigate('create-invoice')}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white font-semibold text-xs tracking-wide shadow-md shadow-emerald-950/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Invoice</span>
          </button>
        )}

        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="hidden md:block text-right">
            <p className="text-xs font-bold text-slate-800 leading-none">
              {user?.full_name || 'Admin'}
            </p>
            <span className="text-[11px] text-slate-500 font-medium capitalize">
              {user?.role_name === 'super_admin' ? 'Super Administrator' : 'Staff Admin'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 text-[#136239] flex items-center justify-center font-bold text-sm shadow-xs">
            <UserCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>
    </header>
  );
};
