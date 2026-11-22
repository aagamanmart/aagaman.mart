import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CreditCard,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { InvoiceModal } from '../components/InvoiceModal';
import { formatINR, useStore } from '../context/StoreContext';
import type { OrderRecord, StoreConfig } from '../types';

const STUDIO_IMAGE_PRESETS: Array<{ label: string; url: string }> = [
  { label: 'Wireless Headphones', url: '/src/assets/images/prod_wireless_headphones_1795321793763.jpg' },
  { label: 'Smartwatch Pro', url: '/src/assets/images/prod_smartwatch_pro_1795321794237.jpg' },
  { label: 'Organic Groceries', url: '/src/assets/images/prod_groceries_organic_1795321794873.jpg' },
  { label: "Men's Jacket", url: '/src/assets/images/prod_fashion_mens_jacket_1795321793933.jpg' },
  { label: "Women's Kurta", url: '/src/assets/images/prod_fashion_womens_kurta_1795321794640.jpg' },
  { label: 'Kitchen Airfryer', url: '/src/assets/images/prod_kitchen_airfryer_1795321794199.jpg' },
  { label: 'Beauty & Skincare', url: '/src/assets/images/prod_beauty_skincare_1795321796092.jpg' },
  { label: 'Footwear Sneakers', url: '/src/assets/images/prod_footwear_sneakers_1795321794437.jpg' },
  { label: 'Brass Home Decor Lamp', url: '/src/assets/images/prod_decor_brass_lamp_1795321794677.jpg' },
  { label: 'Fitness Dumbbells', url: '/src/assets/images/prod_fitness_dumbbells_1795321796300.jpg' },
];

interface AdminProductImage {
  id: number;
  imageUrl: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
}

interface AdminProductItem {
  id: number;
  sku: string;
  name: string;
  brand: string;
  categoryId: number;
  categoryName: string;
  description: string;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  stock: number;
  soldCount: number;
  gstPercent: number;
  returnPolicy: string;
  isActive: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isDealOfDay: boolean;
  images: AdminProductImage[];
}

const ProductThumbnail: React.FC<{ src?: string; alt: string; className?: string }> = ({
  src,
  alt,
  className = 'w-12 h-12',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`${className} rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0`}
        title={alt}
      >
        <Package className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-lg border border-slate-200 bg-slate-50 object-cover shrink-0`}
    />
  );
};

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export const AdminPage: React.FC = () => {
  const { navigate, notify, refreshStoreMeta } = useStore();
  // Security: Admin token kept strictly in React memory
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [envOverrideActive, setEnvOverrideActive] = useState(false);

  // Login / Bootstrap form state
  const [authName, setAuthName] = useState('Store Administrator');
  const [authEmail, setAuthEmail] = useState('admin@aagamanmart.in');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Dashboard tabs
  const [tab, setTab] = useState<
    'overview' | 'products' | 'categories' | 'orders' | 'customers' | 'payments' | 'marketing' | 'settings'
  >('overview');

  // Data states
  const [dashboard, setDashboard] = useState<{
    kpis: Record<string, number>;
    lowStockProducts: Array<{ id: number; name: string; sku: string; stock: number; sellingPrice: number }>;
    bestSellingProducts: Array<{ id: number; name: string; soldCount: number; sellingPrice: number }>;
    recentOrders: OrderRecord[];
    salesChart: Array<{ day: string; revenue: number; orders: number }>;
  } | null>(null);
  const [adminProducts, setAdminProducts] = useState<AdminProductItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [adminCategories, setAdminCategories] = useState<
    Array<{ id: number; name: string; slug: string; description: string; isActive: boolean; subcategories: Array<{ id: number; name: string }> }>
  >([]);
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([]);
  const [adminReturns, setAdminReturns] = useState<
    Array<{ id: number; orderId: number; reason: string; requestType: string; status: string; createdAt: string }>
  >([]);
  const [adminCustomers, setAdminCustomers] = useState<
    Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      isBlocked: boolean;
      orderCount: number;
      totalSpent: number;
    }>
  >([]);
  const [adminPayments, setAdminPayments] = useState<
    Array<{
      id: number;
      orderNumber: string;
      customerName: string;
      gateway: string;
      method: string;
      razorpayPaymentId: string | null;
      amount: number;
      status: string;
      createdAt: string;
    }>
  >([]);
  const [adminCoupons, setAdminCoupons] = useState<
    Array<{
      id: number;
      code: string;
      description: string;
      discountType: string;
      discountValue: number;
      minOrderValue: number;
      usedCount: number;
      usageLimit: number;
      isActive: boolean;
    }>
  >([]);
  const [adminTickets, setAdminTickets] = useState<
    Array<{ id: number; name: string; email: string; subject: string; message: string; status: string; createdAt: string }>
  >([]);
  const [settingsForm, setSettingsForm] = useState<StoreConfig | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);

  // Add Product Form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProd, setNewProd] = useState({
    sku: '',
    name: '',
    brand: '',
    categoryId: 1,
    description: '',
    mrp: 1999,
    sellingPrice: 1499,
    stock: 25,
    gstPercent: 18,
    imageUrl: '/src/assets/images/prod_wireless_headphones_1795321793763.jpg',
  });

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<AdminProductItem | null>(null);
  const [editForm, setEditForm] = useState({
    sku: '',
    name: '',
    brand: '',
    categoryId: 1,
    description: '',
    mrp: 0,
    sellingPrice: 0,
    stock: 0,
    gstPercent: 18,
    returnPolicy: '7 Days Easy Return & Replacement',
    isActive: true,
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    isNewArrival: false,
    isDealOfDay: false,
    imageUrls: [] as string[],
  });
  const [newEditImageUrl, setNewEditImageUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const openEditProduct = (product: AdminProductItem) => {
    const orderedImages = [...(product.images || [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const urls = orderedImages.map((img) => img.imageUrl).filter(Boolean);
    setEditingProduct(product);
    setEditForm({
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      description: product.description,
      mrp: product.mrp,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      gstPercent: product.gstPercent ?? 18,
      returnPolicy: product.returnPolicy || '7 Days Easy Return & Replacement',
      isActive: product.isActive,
      isFeatured: Boolean(product.isFeatured),
      isTrending: Boolean(product.isTrending),
      isBestSeller: Boolean(product.isBestSeller),
      isNewArrival: Boolean(product.isNewArrival),
      isDealOfDay: Boolean(product.isDealOfDay),
      imageUrls: urls.length > 0 ? urls : [STUDIO_IMAGE_PRESETS[0].url],
    });
    setNewEditImageUrl('');
  };

  // Add Category / Subcategory / Coupon forms
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newSubCatId, setNewSubCatId] = useState(1);
  const [newSubName, setNewSubName] = useState('');
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed' | 'free_shipping',
    discountValue: 15,
    minOrderValue: 999,
    maxDiscountLimit: 500,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/status');
        if (res.ok) {
          const json = await res.json();
          setNeedsBootstrap(Boolean(json.needsBootstrap));
          setEnvOverrideActive(Boolean(json.envOverrideActive));
        }
      } finally {
        setStatusLoading(false);
      }
    })();
  }, []);

  const loadAllAdminData = useCallback(async (token: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    const [dRes, pRes, cRes, oRes, uRes, payRes, coupRes, setRes, tickRes] = await Promise.all([
      fetch('/api/admin/dashboard', { headers }),
      fetch('/api/admin/products', { headers }),
      fetch('/api/admin/categories', { headers }),
      fetch('/api/admin/orders', { headers }),
      fetch('/api/admin/customers', { headers }),
      fetch('/api/admin/payments', { headers }),
      fetch('/api/admin/coupons', { headers }),
      fetch('/api/admin/settings', { headers }),
      fetch('/api/admin/support-tickets', { headers }),
    ]);

    if (dRes.ok) setDashboard(await dRes.json());
    if (pRes.ok) setAdminProducts((await pRes.json()).products || []);
    if (cRes.ok) {
      const cats = (await cRes.json()).categories || [];
      setAdminCategories(cats);
      if (cats[0]) {
        setNewProd((prev) => ({ ...prev, categoryId: cats[0].id }));
        setNewSubCatId(cats[0].id);
      }
    }
    if (oRes.ok) {
      const oJson = await oRes.json();
      setAdminOrders(oJson.orders || []);
      setAdminReturns(oJson.returns || []);
    }
    if (uRes.ok) setAdminCustomers((await uRes.json()).customers || []);
    if (payRes.ok) setAdminPayments((await payRes.json()).payments || []);
    if (coupRes.ok) setAdminCoupons((await coupRes.json()).coupons || []);
    if (setRes.ok) setSettingsForm((await setRes.json()).config || null);
    if (tickRes.ok) setAdminTickets((await tickRes.json()).tickets || []);
  }, []);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const endpoint = needsBootstrap ? '/api/admin/bootstrap' : '/api/admin/login';
      const body = needsBootstrap
        ? { name: authName, email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Authentication failed.');
      setAdminToken(json.token);
      setAdminUser(json.admin);
      setNeedsBootstrap(false);
      await loadAllAdminData(json.token);
      notify('Signed in to AAGAMAN MART Admin Console.', 'success');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading Admin Console...
      </div>
    );
  }

  if (!adminToken || !adminUser) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C]">
              AAGAMAN MART · Admin Console
            </p>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A] mt-1">
              {needsBootstrap ? 'Claim Store Administrator Access' : 'Admin Portal Sign In'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {needsBootstrap
                ? 'First-time setup: Create your secure administrator account to unlock store management.'
                : envOverrideActive
                ? 'Enter the configured ADMIN_PASSCODE to access the store console.'
                : 'Separate secure authentication for AAGAMAN MART administrators.'}
            </p>
          </div>

          <form onSubmit={handleAdminAuth} className="space-y-3.5">
            {needsBootstrap && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Name</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            )}
            {!envOverrideActive && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {envOverrideActive ? 'Admin Passcode' : needsBootstrap ? 'Create Password (min 8 chars)' : 'Admin Password'}
              </label>
              <input
                type="password"
                required
                minLength={needsBootstrap ? 8 : 1}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm transition-colors"
            >
              {authSubmitting
                ? 'Verifying...'
                : needsBootstrap
                ? 'Claim Admin Access & Continue'
                : 'Sign In to Admin Console'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-center text-xs text-slate-500 hover:text-[#0B1F3A] font-medium"
          >
            ← Return to AAGAMAN MART Storefront
          </button>
        </div>
      </div>
    );
  }

  const orderStatuses = [
    'Order Placed',
    'Payment Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Return Requested',
    'Returned',
    'Refund Initiated',
    'Refunded',
  ];

  const maxChartRev = Math.max(1, ...(dashboard?.salesChart.map((d) => d.revenue) || [1]));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0B1F3A] text-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-white">AAGAMAN MART</p>
            <p className="text-[11px] text-[#FDBA74]">Admin Store Console</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs text-slate-300 hover:text-white underline lg:hidden"
          >
            Storefront
          </button>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar flex-1">
          {[
            { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
            { id: 'products', label: 'Products & Stock', icon: Package },
            { id: 'categories', label: 'Categories', icon: FolderTree },
            { id: 'orders', label: 'Orders & Returns', icon: ShoppingBag },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
            { id: 'marketing', label: 'Coupons & Banners', icon: Tag },
            { id: 'settings', label: 'Settings & Support', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  tab === item.id
                    ? 'bg-[#EA580C] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 hidden lg:block text-xs">
          <p className="font-semibold text-white truncate">{adminUser.name}</p>
          <p className="text-slate-400 truncate">{adminUser.email}</p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium"
            >
              Storefront
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminToken(null);
                setAdminUser(null);
              }}
              className="px-2.5 py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-white"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 lg:p-8 overflow-x-hidden space-y-6">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs text-slate-500">Admin Console / {tab.toUpperCase()}</p>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A] capitalize">{tab}</h1>
          </div>
          <button
            type="button"
            onClick={() => loadAllAdminData(adminToken)}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
          >
            Refresh Data
          </button>
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', val: formatINR(dashboard.kpis.totalRevenue) },
                { label: 'Total Orders', val: String(dashboard.kpis.totalOrders) },
                { label: 'Total Customers', val: String(dashboard.kpis.totalCustomers) },
                { label: 'Active Products', val: String(dashboard.kpis.totalProducts) },
                { label: 'Pending / Active', val: String(dashboard.kpis.pendingOrders) },
                { label: 'Delivered Orders', val: String(dashboard.kpis.deliveredOrders) },
                { label: 'Cancelled Orders', val: String(dashboard.kpis.cancelledOrders) },
                { label: 'Total Units Sold', val: String(dashboard.kpis.totalUnitsSold) },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className="font-mono text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">{kpi.val}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* 7-Day Sales Bar Chart */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#EA580C]" /> 7-Day Revenue Trend
                  </h2>
                </div>
                <div className="h-48 flex items-end gap-3 pt-4 border-b border-slate-100">
                  {dashboard.salesChart.map((d) => {
                    const heightPct = Math.max(6, Math.round((d.revenue / maxChartRev) * 100));
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {d.revenue > 0 ? formatINR(d.revenue) : '₹0'}
                        </span>
                        <div
                          className="w-full max-w-[40px] rounded-t-md bg-[#EA580C] transition-all"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[11px] font-medium text-slate-600">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low Stock Alerts */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" /> Low-Stock Products
                </h2>
                {dashboard.lowStockProducts.length === 0 ? (
                  <p className="text-xs text-slate-500">All products have healthy inventory levels.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {dashboard.lowStockProducts.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0B1F3A] truncate">{p.name}</p>
                          <p className="font-mono text-slate-500">{p.sku}</p>
                        </div>
                        <span className="font-mono font-bold text-red-600 tabular-nums shrink-0">
                          {p.stock} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Best Sellers & Recent Orders */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">Best-Selling Products</h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {dashboard.bestSellingProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex justify-between gap-3">
                      <span className="font-medium text-slate-800 truncate">{p.name}</span>
                      <span className="font-mono text-slate-600 tabular-nums shrink-0">
                        {p.soldCount} sold · {formatINR(p.sellingPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">Recent Orders</h2>
                {dashboard.recentOrders.length === 0 ? (
                  <p className="text-xs text-slate-500">No orders placed yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {dashboard.recentOrders.map((o) => (
                      <div key={o.id} className="py-2.5 flex justify-between gap-3">
                        <div>
                          <p className="font-mono font-semibold text-[#0B1F3A]">{o.orderNumber}</p>
                          <p className="text-slate-500">{o.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-[#EA580C] tabular-nums">{formatINR(o.grandTotal)}</p>
                          <p className="text-slate-500">{o.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search name, SKU, brand..."
                    className="h-9 pl-8 pr-3 rounded-lg border border-slate-300 bg-white text-xs w-60 focus:outline-none focus:border-[#0B1F3A]"
                  />
                </div>
                <select
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
                >
                  <option value="all">All Status ({adminProducts.length})</option>
                  <option value="active">
                    Active ({adminProducts.filter((p) => p.isActive).length})
                  </option>
                  <option value="archived">
                    Archived ({adminProducts.filter((p) => !p.isActive).length})
                  </option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProduct((v) => !v)}
                className="px-4 py-2 rounded-lg bg-[#EA580C] text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {showAddProduct && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({
                      ...newProd,
                      imageUrls: [newProd.imageUrl],
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) notify(json.error || 'Error creating product', 'error');
                  else {
                    notify('Product added to store!', 'success');
                    setShowAddProduct(false);
                    await loadAllAdminData(adminToken);
                    refreshStoreMeta();
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 grid sm:grid-cols-3 gap-3 text-xs"
              >
                <input
                  required
                  placeholder="SKU (e.g. AAG-NEW-101)"
                  value={newProd.sku}
                  onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  required
                  placeholder="Product Name"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-slate-300"
                />
                <input
                  required
                  placeholder="Brand"
                  value={newProd.brand}
                  onChange={(e) => setNewProd({ ...newProd, brand: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-slate-300"
                />
                <select
                  value={newProd.categoryId}
                  onChange={(e) => setNewProd({ ...newProd, categoryId: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  {adminCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  placeholder="MRP ₹"
                  value={newProd.mrp}
                  onChange={(e) => setNewProd({ ...newProd, mrp: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="Selling Price ₹"
                  value={newProd.sellingPrice}
                  onChange={(e) => setNewProd({ ...newProd, sellingPrice: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="Initial Stock"
                  value={newProd.stock}
                  onChange={(e) => setNewProd({ ...newProd, stock: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="GST %"
                  value={newProd.gstPercent}
                  onChange={(e) => setNewProd({ ...newProd, gstPercent: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <div className="flex items-center gap-2">
                  <ProductThumbnail src={newProd.imageUrl} alt="New product preview" className="w-9 h-9" />
                  <input
                    required
                    placeholder="Image URL"
                    value={newProd.imageUrl}
                    onChange={(e) => setNewProd({ ...newProd, imageUrl: e.target.value })}
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setNewProd({ ...newProd, imageUrl: e.target.value });
                  }}
                  className="sm:col-span-3 h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
                >
                  <option value="">Quick-pick a studio product image (optional)...</option>
                  {STUDIO_IMAGE_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <textarea
                  required
                  placeholder="Product Description"
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="sm:col-span-3 p-3 rounded-lg border border-slate-300"
                  rows={2}
                />
                <button type="submit" className="sm:col-span-3 h-10 rounded-lg bg-[#0B1F3A] text-white font-semibold">
                  Publish Product
                </button>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Product & Image</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Price (₹)</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminProducts
                    .filter((p) => {
                      if (productStatusFilter === 'active' && !p.isActive) return false;
                      if (productStatusFilter === 'archived' && p.isActive) return false;
                      const q = productSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.sku.toLowerCase().includes(q) ||
                        p.brand.toLowerCase().includes(q) ||
                        p.categoryName.toLowerCase().includes(q)
                      );
                    })
                    .map((p) => {
                      const primaryImage =
                        p.images?.find((img) => img.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <ProductThumbnail src={primaryImage} alt={p.name} className="w-12 h-12" />
                              <div className="min-w-0">
                                <p className="font-semibold text-[#0B1F3A] truncate max-w-[260px]">{p.name}</p>
                                <p className="font-mono text-slate-500 mt-0.5">
                                  {p.sku} · {p.brand}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {p.images?.length || 0} {p.images?.length === 1 ? 'image' : 'images'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{p.categoryName}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <span className="font-semibold text-[#0B1F3A]">{formatINR(p.sellingPrice)}</span>
                            {p.mrp > p.sellingPrice && (
                              <span className="block text-[11px] text-slate-400 line-through">
                                {formatINR(p.mrp)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <button
                              type="button"
                              onClick={async () => {
                                await fetch(`/api/admin/products/${p.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${adminToken}`,
                                  },
                                  body: JSON.stringify({ stock: p.stock + 10 }),
                                });
                                notify(`Restocked +10 units for ${p.sku}`, 'success');
                                loadAllAdminData(adminToken);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-semibold"
                              title="Click to restock +10"
                            >
                              {p.stock} (+10)
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[11px] font-semibold ${
                                p.isActive ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {p.isActive ? 'Active' : 'Archived'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B1F3A] font-semibold inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#EA580C]" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch(`/api/admin/products/${p.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${adminToken}`,
                                    },
                                    body: JSON.stringify({ isActive: !p.isActive }),
                                  });
                                  notify(p.isActive ? 'Product archived.' : 'Product restored.', 'info');
                                  await loadAllAdminData(adminToken);
                                  refreshStoreMeta();
                                }}
                                className={`font-medium hover:underline ${
                                  p.isActive ? 'text-red-600' : 'text-emerald-700'
                                }`}
                              >
                                {p.isActive ? 'Archive' : 'Restore'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab === 'categories' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {adminCategories.map((c) => (
                <div key={c.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <p className="font-bold text-sm text-[#0B1F3A]">{c.name}</p>
                    <p className="text-slate-500 mt-0.5">{c.description}</p>
                    {c.subcategories.length > 0 && (
                      <p className="text-slate-600 mt-1">
                        Subcategories: {c.subcategories.map((s) => s.name).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/admin/categories/${c.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${adminToken}` },
                      });
                      loadAllAdminData(adminToken);
                      refreshStoreMeta();
                    }}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="lg:col-span-5 space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ name: newCatName, description: newCatDesc }),
                  });
                  if (res.ok) {
                    setNewCatName('');
                    setNewCatDesc('');
                    loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    notify('Category created!', 'success');
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs"
              >
                <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Add New Category</h3>
                <input
                  required
                  placeholder="Category Name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
                <input
                  placeholder="Category Description"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
                <button type="submit" className="w-full h-9 rounded-lg bg-[#EA580C] text-white font-semibold">
                  Create Category
                </button>
              </form>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/subcategories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ categoryId: newSubCatId, name: newSubName }),
                  });
                  if (res.ok) {
                    setNewSubName('');
                    loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    notify('Subcategory added!', 'success');
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs"
              >
                <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Add Subcategory</h3>
                <select
                  value={newSubCatId}
                  onChange={(e) => setNewSubCatId(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  {adminCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Subcategory Name"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
                <button type="submit" className="w-full h-9 rounded-lg bg-[#0B1F3A] text-white font-semibold">
                  Add Subcategory
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ORDERS & RETURNS */}
        {tab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Update Lifecycle Status</th>
                    <th className="py-3 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-[#0B1F3A]">{o.orderNumber}</p>
                        <p className="text-slate-500 font-mono">{o.shipping?.trackingNumber}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{o.customerName}</p>
                        <p className="text-slate-500">{o.addressSnapshot.city}</p>
                      </td>
                      <td className="py-3 px-4">
                        {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        {formatINR(o.grandTotal)}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={o.status}
                          onChange={async (e) => {
                            await fetch(`/api/admin/orders/${o.id}/status`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                              body: JSON.stringify({ status: e.target.value }),
                            });
                            notify(`Order ${o.orderNumber} updated to ${e.target.value}`, 'success');
                            loadAllAdminData(adminToken);
                          }}
                          className="h-8 px-2 rounded border border-slate-300 bg-white text-xs font-medium"
                        >
                          {orderStatuses.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInvoiceOrder(o)}
                          className="text-[#EA580C] font-semibold hover:underline"
                        >
                          View PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Returns Queue */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">Return & Refund Requests</h3>
              {adminReturns.length === 0 ? (
                <p className="text-xs text-slate-500">No return requests submitted.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {adminReturns.map((r) => (
                    <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">
                          Return #{r.id} (Order #{r.orderId}) · {r.requestType.toUpperCase()}
                        </p>
                        <p className="text-slate-600">{r.reason}</p>
                        <p className="text-slate-400">Status: {r.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/returns/${r.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                              body: JSON.stringify({ status: 'Returned', issueRefund: true }),
                            });
                            notify('Return approved and refund processed!', 'success');
                            loadAllAdminData(adminToken);
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-700 text-white font-semibold"
                        >
                          Approve & Issue Refund
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/returns/${r.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                              body: JSON.stringify({ status: 'Rejected', issueRefund: false }),
                            });
                            loadAllAdminData(adminToken);
                          }}
                          className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Total Spend</th>
                  <th className="py-3 px-4 text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminCustomers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0B1F3A]">{c.name}</p>
                      <p className="text-slate-500">{c.email}</p>
                    </td>
                    <td className="py-3 px-4 font-mono">{c.phone || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{c.orderCount}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      {formatINR(c.totalSpent)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/customers/${c.id}/block`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                            body: JSON.stringify({ isBlocked: !c.isBlocked }),
                          });
                          loadAllAdminData(adminToken);
                        }}
                        className={`px-3 py-1 rounded font-semibold ${
                          c.isBlocked ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.isBlocked ? 'Blocked (Unblock)' : 'Active (Block)'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Gateway & Method</th>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-[#0B1F3A]">{p.orderNumber}</td>
                    <td className="py-3 px-4">
                      {p.gateway.toUpperCase()} · {p.method.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{p.razorpayPaymentId || 'COD Pending'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">{formatINR(p.amount)}</td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'cod_pending' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/payments/${p.id}/cod-collected`, {
                              method: 'PATCH',
                              headers: { Authorization: `Bearer ${adminToken}` },
                            });
                            notify('COD cash marked collected.', 'success');
                            loadAllAdminData(adminToken);
                          }}
                          className="px-3 py-1 rounded bg-[#EA580C] text-white font-semibold"
                        >
                          Mark COD Collected
                        </button>
                      ) : (
                        <span className="font-semibold text-emerald-700 uppercase">{p.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MARKETING & COUPONS */}
        {tab === 'marketing' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {adminCoupons.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-mono font-bold text-sm text-[#0B1F3A]">{c.code}</p>
                    <p className="text-slate-600">{c.description}</p>
                    <p className="text-slate-400 mt-0.5 tabular-nums">
                      Used {c.usedCount}/{c.usageLimit} · Min ₹{c.minOrderValue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/coupons/${c.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                          body: JSON.stringify({ isActive: !c.isActive }),
                        });
                        loadAllAdminData(adminToken);
                        refreshStoreMeta();
                      }}
                      className={`px-3 py-1 rounded font-semibold ${
                        c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/coupons/${c.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${adminToken}` },
                        });
                        loadAllAdminData(adminToken);
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/coupons', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                  body: JSON.stringify(newCoupon),
                });
                if (res.ok) {
                  setNewCoupon({ ...newCoupon, code: '', description: '' });
                  loadAllAdminData(adminToken);
                  refreshStoreMeta();
                  notify('Coupon created!', 'success');
                }
              }}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs"
            >
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Create Promotional Coupon</h3>
              <input
                required
                placeholder="Code (e.g. DIWALI20)"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono uppercase"
              />
              <input
                required
                placeholder="Description"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCoupon.discountType}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, discountType: e.target.value as 'percentage' | 'fixed' | 'free_shipping' })
                  }
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
                <input
                  type="number"
                  placeholder="Value"
                  value={newCoupon.discountValue}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min Order ₹"
                  value={newCoupon.minOrderValue}
                  onChange={(e) => setNewCoupon({ ...newCoupon, minOrderValue: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  placeholder="Max Discount ₹"
                  value={newCoupon.maxDiscountLimit}
                  onChange={(e) => setNewCoupon({ ...newCoupon, maxDiscountLimit: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
              </div>
              <button type="submit" className="w-full h-9 rounded-lg bg-[#EA580C] text-white font-semibold">
                Save Coupon
              </button>
            </form>
          </div>
        )}

        {/* SETTINGS & SUPPORT TICKETS */}
        {tab === 'settings' && settingsForm && (
          <div className="grid lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                  body: JSON.stringify({ config: settingsForm }),
                });
                if (res.ok) {
                  await refreshStoreMeta();
                  notify('Store settings updated!', 'success');
                }
              }}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs"
            >
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">Store, Shipping & GST Settings</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Announcement Banner</label>
                  <input
                    value={settingsForm.announcementText}
                    onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Support Phone</label>
                  <input
                    value={settingsForm.supportPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, supportPhone: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Free Shipping Threshold (₹)</label>
                  <input
                    type="number"
                    value={settingsForm.freeShippingThreshold}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, freeShippingThreshold: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Standard Shipping Fee (₹)</label>
                  <input
                    type="number"
                    value={settingsForm.standardShippingCharge}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, standardShippingCharge: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Express Shipping Fee (₹)</label>
                  <input
                    type="number"
                    value={settingsForm.expressShippingCharge}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, expressShippingCharge: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Flash Sale Headline</label>
                  <input
                    value={settingsForm.flashSaleTitle}
                    onChange={(e) => setSettingsForm({ ...settingsForm, flashSaleTitle: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <button type="submit" className="px-5 h-9 rounded-lg bg-[#EA580C] text-white font-semibold">
                Save Configuration
              </button>

              <div className="pt-4 border-t border-slate-200 space-y-2 text-slate-600">
                <p className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#EA580C]" /> Live Payment & Notification Credentials
                </p>
                <p>
                  To switch from Sandbox Mode to Live Razorpay India payments and automated Email/SMS/WhatsApp dispatches, add{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">RAZORPAY_KEY_ID</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">RAZORPAY_KEY_SECRET</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">SMTP_HOST</code>, and{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">TWILIO_ACCOUNT_SID</code> in AI Studio Settings → Secrets.
                </p>
              </div>
            </form>

            {/* Support Tickets */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
              <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#EA580C]" /> Customer Support Tickets ({adminTickets.length})
              </h3>
              {adminTickets.length === 0 ? (
                <p className="text-slate-500">No support tickets yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {adminTickets.map((t) => (
                    <div key={t.id} className="py-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#0B1F3A]">{t.subject}</span>
                        <select
                          value={t.status}
                          onChange={async (e) => {
                            await fetch(`/api/admin/support-tickets/${t.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                              body: JSON.stringify({ status: e.target.value }),
                            });
                            loadAllAdminData(adminToken);
                          }}
                          className="h-7 px-2 rounded border border-slate-300 bg-white text-[11px]"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                      <p className="text-slate-600">{t.message}</p>
                      <p className="text-slate-400">
                        {t.name} ({t.email})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <ProductThumbnail
                  src={editForm.imageUrls[0]}
                  alt={editForm.name || editingProduct.name}
                  className="w-11 h-11 border-white/20"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-orange-300 uppercase tracking-wider">
                    Edit Product · {editingProduct.sku}
                  </p>
                  <h2 className="font-display text-base font-bold truncate">
                    {editForm.name || editingProduct.name}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-200"
                aria-label="Close edit product modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editForm.imageUrls.length === 0) {
                  notify('Please keep at least one product image.', 'error');
                  return;
                }
                setEditSaving(true);
                try {
                  const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${adminToken}`,
                    },
                    body: JSON.stringify(editForm),
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    notify(json.error || 'Failed to save product updates.', 'error');
                  } else {
                    notify('Product details and images updated!', 'success');
                    setEditingProduct(null);
                    await loadAllAdminData(adminToken);
                    refreshStoreMeta();
                  }
                } finally {
                  setEditSaving(false);
                }
              }}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
            >
              {/* Image Gallery Manager */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#EA580C]" /> Product Images ({editForm.imageUrls.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">First image appears as the storefront thumbnail</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {editForm.imageUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className={`bg-white border rounded-xl p-2 flex flex-col gap-2 ${
                        idx === 0 ? 'border-[#EA580C]' : 'border-slate-200'
                      }`}
                    >
                      <ProductThumbnail src={url} alt={`Product image ${idx + 1}`} className="w-full h-24" />
                      <input
                        value={url}
                        onChange={(e) => {
                          const next = [...editForm.imageUrls];
                          next[idx] = e.target.value;
                          setEditForm({ ...editForm, imageUrls: next });
                        }}
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px] font-mono text-slate-600"
                        placeholder="Image URL"
                      />
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        {idx === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EA580C]">
                            <Star className="w-3 h-3 fill-[#EA580C]" /> Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...editForm.imageUrls];
                              const [selected] = next.splice(idx, 1);
                              next.unshift(selected);
                              setEditForm({ ...editForm, imageUrls: next });
                            }}
                            className="text-[11px] font-semibold text-[#0B1F3A] hover:text-[#EA580C]"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={editForm.imageUrls.length <= 1}
                          onClick={() => {
                            if (editForm.imageUrls.length <= 1) return;
                            setEditForm({
                              ...editForm,
                              imageUrls: editForm.imageUrls.filter((_, i) => i !== idx),
                            });
                          }}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-12 gap-2 pt-1">
                  <input
                    value={newEditImageUrl}
                    onChange={(e) => setNewEditImageUrl(e.target.value)}
                    placeholder="Paste image URL (https://... or /src/assets/images/...)"
                    className="sm:col-span-6 h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newEditImageUrl.trim();
                      if (!trimmed) return;
                      setEditForm({ ...editForm, imageUrls: [...editForm.imageUrls, trimmed] });
                      setNewEditImageUrl('');
                    }}
                    className="sm:col-span-2 h-9 rounded-lg bg-[#0B1F3A] text-white font-semibold"
                  >
                    + Add URL
                  </button>
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setEditForm({ ...editForm, imageUrls: [...editForm.imageUrls, e.target.value] });
                    }}
                    className="sm:col-span-4 h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700"
                  >
                    <option value="">+ Quick-add Studio Photo...</option>
                    {STUDIO_IMAGE_PRESETS.map((preset) => (
                      <option key={preset.url} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Details & Pricing */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-500 font-medium mb-1">Product Name</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">SKU</label>
                  <input
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Brand</label>
                  <input
                    required
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Category</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  >
                    {adminCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Return Policy</label>
                  <input
                    required
                    value={editForm.returnPolicy}
                    onChange={(e) => setEditForm({ ...editForm, returnPolicy: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.mrp}
                    onChange={(e) => setEditForm({ ...editForm, mrp: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.sellingPrice}
                    onChange={(e) => setEditForm({ ...editForm, sellingPrice: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Stock</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editForm.stock}
                      onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">GST (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={28}
                      required
                      value={editForm.gstPercent}
                      onChange={(e) => setEditForm({ ...editForm, gstPercent: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Product Description</label>
                <textarea
                  required
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { key: 'isActive', label: 'Active on Storefront' },
                  { key: 'isFeatured', label: 'Featured Collection' },
                  { key: 'isBestSeller', label: 'Best Seller' },
                  { key: 'isTrending', label: 'Trending Now' },
                  { key: 'isNewArrival', label: 'New Arrival' },
                  { key: 'isDealOfDay', label: 'Deal of the Day' },
                ].map((flag) => {
                  const checked = Boolean(editForm[flag.key as keyof typeof editForm]);
                  return (
                    <label
                      key={flag.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setEditForm({ ...editForm, [flag.key]: e.target.checked })}
                        className="accent-[#EA580C]"
                      />
                      <span className="font-medium text-[#0B1F3A]">{flag.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 h-9 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 h-9 rounded-lg bg-[#EA580C] hover:bg-[#dc4c05] text-white font-semibold disabled:opacity-60"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
    </div>
  );
};
