import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Package,
  Users,
  TrendingDown,
  Settings,
  ShieldCheck,
  History,
  LogOut,
  X,
  Building2,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type NavTab =
  | 'dashboard'
  | 'create-invoice'
  | 'invoices'
  | 'products'
  | 'customers'
  | 'reports'
  | 'settings'
  | 'change-password'
  | 'users'
  | 'logs';

interface SidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  appName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpen,
  onClose,
  appName = 'Info Papandayan',
}) => {
  const { user, logout, isSuperAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create-invoice' as NavTab, label: 'Buat Invoice', icon: FilePlus2, highlight: true },
    { id: 'invoices' as NavTab, label: 'Daftar Invoice', icon: FileText },
    { id: 'products' as NavTab, label: 'Daftar Produk', icon: Package },
    { id: 'customers' as NavTab, label: 'Pelanggan', icon: Users },
    { id: 'reports' as NavTab, label: 'Laporan Barang Keluar', icon: TrendingDown },
    { id: 'settings' as NavTab, label: 'Pengaturan', icon: Settings },
    { id: 'change-password' as NavTab, label: 'Ganti Password', icon: KeyRound },
    ...(isSuperAdmin
      ? [{ id: 'users' as NavTab, label: 'Kelola Pengguna', icon: ShieldCheck }]
      : []),
    { id: 'logs' as NavTab, label: 'Log Aktivitas', icon: History },
  ];

  const handleNavClick = (tab: NavTab) => {
    setCurrentTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-18 px-6 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#136239] flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-900/40 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight leading-snug truncate">
                {appName}
              </h1>
              <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                Enterprise Portal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5 custom-scrollbar">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Menu Navigasi
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group text-left ${
                  isActive
                    ? 'bg-[#136239] text-white shadow-md shadow-emerald-950/40'
                    : item.highlight
                    ? 'text-emerald-300 hover:text-white hover:bg-slate-800/80 bg-emerald-950/40 border border-emerald-800/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive
                      ? 'text-white'
                      : item.highlight
                      ? 'text-emerald-400'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="truncate flex-1">{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                    Baru
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.full_name || 'Pengguna'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    isSuperAdmin ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {user?.role_name === 'super_admin' ? 'Super Admin' : 'Admin'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar / Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
