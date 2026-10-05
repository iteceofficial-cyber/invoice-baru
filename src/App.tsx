import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { LoginView } from './views/LoginView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { CreateInvoiceView } from './views/CreateInvoiceView.tsx';
import { InvoicesListView } from './views/InvoicesListView.tsx';
import { ProductsView } from './views/ProductsView.tsx';
import { CustomersView } from './views/CustomersView.tsx';
import { ReportsView } from './views/ReportsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { UsersView } from './views/UsersView.tsx';
import { ActivityLogsView } from './views/ActivityLogsView.tsx';
import { ChangePasswordView } from './views/ChangePasswordView.tsx';
import { PublicInvoiceView } from './views/PublicInvoiceView.tsx';
import { apiRequest } from './services/api.ts';

function MainAppContent() {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if public invoice URL parameter is present (?inv=..., ?id=..., or /invoice/...)
  const [publicInvoiceIdentifier, setPublicInvoiceIdentifier] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const pathname = window.location.pathname;
      const hash = window.location.hash;

      const params = new URLSearchParams(search);
      let val =
        params.get('inv') ||
        params.get('invoice') ||
        params.get('public_invoice') ||
        params.get('id') ||
        params.get('no') ||
        params.get('nomor') ||
        params.get('faktur');
      if (val) return val;

      if (hash && hash.includes('?')) {
        const hashParams = new URLSearchParams(hash.split('?')[1]);
        val =
          hashParams.get('inv') ||
          hashParams.get('invoice') ||
          hashParams.get('public_invoice') ||
          hashParams.get('id') ||
          hashParams.get('no') ||
          hashParams.get('nomor');
        if (val) return val;
      }

      // Check pathname (e.g., /invoice/INV/2026/10/0001, /inv/1, /download/INV-...)
      const pathMatch = pathname.match(/^\/(?:invoice|inv|download|unduh|public-invoice|faktur)\/(.+)$/i);
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1]);
      }
    }
    return null;
  });

  // Cross-view state
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<number | null>(null);

  // App settings for dynamic header branding
  const [appName, setAppName] = useState('Info Papandayan - Invoice & Logistik');
  const [companyName, setCompanyName] = useState('Info Papandayan');

  useEffect(() => {
    loadBranding();
  }, [isAuthenticated]);

  const loadBranding = async () => {
    try {
      const pubRes = await apiRequest('/api/settings/public');
      if (pubRes.success && pubRes.data) {
        if (pubRes.data.app_name) setAppName(pubRes.data.app_name);
        if (pubRes.data.company_name) setCompanyName(pubRes.data.company_name);
        return;
      }
      if (isAuthenticated) {
        const invSetRes = await apiRequest('/api/settings/invoice');
        if (invSetRes.success && invSetRes.data?.app_name) {
          setAppName(invSetRes.data.app_name);
        }
        const compRes = await apiRequest('/api/settings/company');
        if (compRes.success && compRes.data?.company_name) {
          setCompanyName(compRes.data.company_name);
        }
      }
    } catch (e) {
      // Keep default fallback branding
    }
  };

  // If public invoice download/view link is accessed
  if (publicInvoiceIdentifier) {
    return (
      <PublicInvoiceView
        invoiceIdentifier={publicInvoiceIdentifier}
        onGoToLogin={() => {
          setPublicInvoiceIdentifier(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  // If loading authentication state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Memuat Sistem Invoice & Logistik...</p>
      </div>
    );
  }

  // If not logged in, show Login page
  if (!isAuthenticated) {
    return (
      <LoginView
        onOpenPublicInvoice={(id) => {
          setPublicInvoiceIdentifier(id);
          window.history.pushState({}, '', `/?inv=${encodeURIComponent(id)}`);
        }}
      />
    );
  }

  // Navigation handlers with clean state reset
  const handleNavigate = (tab: NavTab) => {
    if (tab !== 'create-invoice') {
      setEditInvoiceId(null);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditInvoice = (id: number) => {
    setEditInvoiceId(id);
    setCurrentTab('create-invoice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviewInvoice = (id: number) => {
    setPreviewInvoiceId(id);
    setCurrentTab('invoices');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={handleNavigate}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        appName={appName}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 transition-all">
        {/* Header */}
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          currentTab={currentTab}
          onNavigate={handleNavigate}
          companyName={companyName}
        />

        {/* View Router */}
        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onPreviewInvoice={handlePreviewInvoice}
            />
          )}

          {currentTab === 'create-invoice' && (
            <CreateInvoiceView
              onNavigate={handleNavigate}
              editInvoiceId={editInvoiceId}
              onClearEdit={() => setEditInvoiceId(null)}
            />
          )}

          {currentTab === 'invoices' && (
            <InvoicesListView
              onNavigate={handleNavigate}
              onEditInvoice={handleEditInvoice}
              previewInvoiceId={previewInvoiceId}
              onClearPreview={() => setPreviewInvoiceId(null)}
            />
          )}

          {currentTab === 'products' && <ProductsView />}

          {currentTab === 'customers' && <CustomersView />}

          {currentTab === 'reports' && <ReportsView />}

          {currentTab === 'settings' && <SettingsView />}

          {currentTab === 'change-password' && <ChangePasswordView />}

          {currentTab === 'users' && (
            isSuperAdmin ? <UsersView /> : <DashboardView onNavigate={handleNavigate} onPreviewInvoice={handlePreviewInvoice} />
          )}

          {currentTab === 'logs' && <ActivityLogsView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainAppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
