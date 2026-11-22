import React from 'react';
import { AuthModal } from './components/AuthModal';
import { CartDrawer } from './components/CartDrawer';
import { CompareModal } from './components/CompareModal';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { StoreProvider, useStore } from './context/StoreContext';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ShopPage } from './pages/ShopPage';
import { FaqPage, PolicyPage, SupportPage } from './pages/SupportPages';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C]">AAGAMAN MART</p>
            <h1 className="font-display text-xl font-bold text-[#0B1F3A]">Something went wrong</h1>
            <p className="text-xs text-slate-600">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
            >
              Reload Store
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppRouter: React.FC = () => {
  const { route, backendUnavailable } = useStore();
  const path = route.split('?')[0];

  if (path.startsWith('/admin')) {
    return <AdminPage />;
  }

  let page: React.ReactNode = <HomePage />;
  if (path === '/shop' || path.startsWith('/category/')) {
    page = <ShopPage />;
  } else if (path.startsWith('/product/')) {
    const slug = path.replace('/product/', '').split('/')[0];
    page = <ProductDetailPage slug={slug} />;
  } else if (path === '/checkout') {
    page = <CheckoutPage />;
  } else if (path === '/account') {
    page = <AccountPage />;
  } else if (path === '/support') {
    page = <SupportPage />;
  } else if (path === '/faq') {
    page = <FaqPage />;
  } else if (path.startsWith('/policy/')) {
    const type = path.replace('/policy/', '').split('/')[0];
    page = <PolicyPage type={type} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar />
      {backendUnavailable && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs text-center">
          Static preview detected: Backend API (<code className="font-mono">/api/*</code>) and PostgreSQL database are
          not active on static hosts like GitHub Pages. Deploy with Node.js (<code className="font-mono">npm run build && npm start</code>) for full catalog, auth, checkout, and admin features.
        </div>
      )}
      <div className="flex-1">{page}</div>
      <Footer />
      <CartDrawer />
      <AuthModal />
      <CompareModal />
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <StoreProvider>
        <AppRouter />
      </StoreProvider>
    </AppErrorBoundary>
  );
}
