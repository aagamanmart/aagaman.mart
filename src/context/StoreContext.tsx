import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type {
  CartItem,
  Category,
  Product,
  ProductVariant,
  PublicCoupon,
  StoreConfig,
  UserProfile,
} from '../types';

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

const BASE_PREFIX = (() => {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base.slice(0, -1) : base;
})();

function stripBasePrefix(pathnameWithSearch: string): string {
  if (BASE_PREFIX && pathnameWithSearch.startsWith(BASE_PREFIX)) {
    const stripped = pathnameWithSearch.slice(BASE_PREFIX.length);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return pathnameWithSearch || '/';
}

function withBasePrefix(appRoute: string): string {
  if (!BASE_PREFIX) return appRoute;
  return appRoute.startsWith('/') ? `${BASE_PREFIX}${appRoute}` : `${BASE_PREFIX}/${appRoute}`;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  route: string;
  navigate: (to: string) => void;
  backendUnavailable: boolean;
  config: StoreConfig | null;
  paymentMode: 'live' | 'sandbox';
  razorpayKeyId: string;
  publicCoupons: PublicCoupon[];
  categories: Category[];
  user: UserProfile | null;
  authToken: string | null;
  authLoading: boolean;
  setCustomerSession: (token: string, user: UserProfile) => Promise<void>;
  refreshUser: () => Promise<void>;
  logoutCustomer: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartSavings: number;
  addToCart: (product: Product, variant?: ProductVariant | null, quantity?: number) => Promise<boolean>;
  updateCartQty: (item: CartItem, quantity: number) => Promise<void>;
  removeCartItem: (item: CartItem) => Promise<void>;
  clearLocalCartAfterOrder: () => void;
  reloadCart: () => Promise<void>;
  wishlistIds: number[];
  wishlistProducts: Product[];
  toggleWishlist: (product: Product) => Promise<void>;
  moveWishlistToCart: (productId: number) => Promise<void>;
  recentlyViewed: Product[];
  recordProductView: (product: Product) => void;
  compareProducts: Product[];
  toggleCompare: (product: Product) => void;
  clearCompare: () => void;
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  appliedCouponCode: string;
  setAppliedCouponCode: (code: string) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isCompareOpen: boolean;
  setIsCompareOpen: (open: boolean) => void;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  refreshStoreMeta: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<string>(() => stripBasePrefix(window.location.pathname + window.location.search));
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [paymentMode, setPaymentMode] = useState<'live' | 'sandbox'>('sandbox');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [publicCoupons, setPublicCoupons] = useState<PublicCoupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Security: customer authToken kept strictly in React memory (never localStorage)
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = authToken;

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('aagaman_guest_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('aagaman_recent_viewed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [compareProducts, setCompareProducts] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aagaman_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const navigate = useCallback((to: string) => {
    const normalized = to.startsWith('/') ? to : `/${to}`;
    const targetUrl = withBasePrefix(normalized);
    if (targetUrl !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', targetUrl);
    }
    setRoute(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(stripBasePrefix(window.location.pathname + window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshStoreMeta = useCallback(async () => {
    try {
      const [cfgRes, catRes] = await Promise.all([fetch('/api/store/config'), fetch('/api/categories')]);
      if (cfgRes.ok) {
        const cfgJson = await cfgRes.json();
        setConfig(cfgJson.config);
        setPublicCoupons(cfgJson.coupons || []);
        setPaymentMode(cfgJson.payment?.mode || 'sandbox');
        setRazorpayKeyId(cfgJson.payment?.razorpayKeyId || '');
        setBackendUnavailable(false);
      } else {
        setBackendUnavailable(true);
      }
      if (catRes.ok) {
        const catJson = await catRes.json();
        setCategories(catJson.categories || []);
      }
    } catch (err) {
      console.error('Store meta load error:', err);
      setBackendUnavailable(true);
    }
  }, []);

  useEffect(() => {
    refreshStoreMeta();
  }, [refreshStoreMeta]);

  const loadAuthenticatedUserData = useCallback(async (token: string) => {
    // Merge guest cart if any exists
    let guestItems: CartItem[] = [];
    try {
      const raw = localStorage.getItem('aagaman_guest_cart');
      guestItems = raw ? JSON.parse(raw) : [];
    } catch {
      guestItems = [];
    }

    if (guestItems.length > 0) {
      await fetch('/api/cart/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: guestItems.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });
      localStorage.removeItem('aagaman_guest_cart');
    }

    const [cartRes, wishRes] = await Promise.all([
      fetch('/api/cart', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (cartRes.ok) {
      const cJson = await cartRes.json();
      setCart(cJson.items || []);
    }
    if (wishRes.ok) {
      const wJson = await wishRes.json();
      setWishlistProducts(wJson.items || []);
    }
  }, []);

  // Listen to Firebase Auth state (Google Sign-In)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/firebase-sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const json = await res.json();
            setAuthToken(idToken);
            setUser(json.user);
            await loadAuthenticatedUserData(idToken);
          }
        } catch (err) {
          console.error('Firebase sync error:', err);
        }
      } else if (!tokenRef.current) {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [loadAuthenticatedUserData]);

  // Persist guest cart only when logged out
  useEffect(() => {
    if (!authToken) {
      try {
        localStorage.setItem('aagaman_guest_cart', JSON.stringify(cart));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [cart, authToken]);

  const setCustomerSession = useCallback(
    async (token: string, nextUser: UserProfile) => {
      setAuthToken(token);
      setUser(nextUser);
      await loadAuthenticatedUserData(token);
    },
    [loadAuthenticatedUserData]
  );

  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) return;
    const res = await fetch('/api/account/me', {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (res.ok) {
      const json = await res.json();
      setUser(json.user);
    }
  }, []);

  const logoutCustomer = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if custom email login
    }
    setAuthToken(null);
    setUser(null);
    setCart([]);
    setWishlistProducts([]);
    localStorage.removeItem('aagaman_guest_cart');
    notify('Signed out successfully.', 'info');
  }, [notify]);

  const reloadCart = useCallback(async () => {
    if (!tokenRef.current) return;
    const res = await fetch('/api/cart', {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (res.ok) {
      const json = await res.json();
      setCart(json.items || []);
    }
  }, []);

  const addToCart = useCallback(
    async (product: Product, variant?: ProductVariant | null, quantity = 1): Promise<boolean> => {
      const chosenVariant = variant ?? (product.variants?.[0] || null);
      const stock = chosenVariant ? chosenVariant.stock : product.stock;
      if (stock <= 0) {
        notify('This item is currently out of stock.', 'error');
        return false;
      }

      if (tokenRef.current) {
        const res = await fetch('/api/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({
            productId: product.id,
            variantId: chosenVariant?.id ?? null,
            quantity,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          notify(json.error || 'Could not add item to cart.', 'error');
          return false;
        }
        setCart(json.items || []);
        notify(`Added "${product.name}" to your cart.`, 'success');
        return true;
      }

      // Guest cart
      const unitPrice = product.sellingPrice + (chosenVariant?.priceAdjustment || 0);
      const mrp = product.mrp + (chosenVariant?.priceAdjustment || 0);
      const primaryImg = product.images?.find((i) => i.isPrimary)?.imageUrl || product.images?.[0]?.imageUrl || '';
      const variantId = chosenVariant?.id ?? null;

      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => item.productId === product.id && item.variantId === variantId
        );
        if (existingIdx >= 0) {
          const copy = [...prev];
          const nextQty = Math.min(copy[existingIdx].quantity + quantity, stock);
          copy[existingIdx] = { ...copy[existingIdx], quantity: nextQty };
          return copy;
        }
        return [
          ...prev,
          {
            id: Date.now() + Math.floor(Math.random() * 1000),
            productId: product.id,
            variantId,
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            sku: chosenVariant?.sku || product.sku,
            imageUrl: primaryImg,
            variantLabel: chosenVariant ? `${chosenVariant.color} · ${chosenVariant.size}` : 'Standard',
            quantity: Math.min(quantity, stock),
            unitPrice,
            mrp,
            gstPercent: product.gstPercent,
            categoryId: product.categoryId,
            availableStock: stock,
          },
        ];
      });
      notify(`Added "${product.name}" to your cart.`, 'success');
      return true;
    },
    [notify]
  );

  const updateCartQty = useCallback(
    async (item: CartItem, quantity: number) => {
      if (tokenRef.current) {
        const res = await fetch(`/api/cart/items/${item.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({ quantity }),
        });
        const json = await res.json();
        if (res.ok) setCart(json.items || []);
        else notify(json.error || 'Could not update quantity.', 'error');
        return;
      }

      if (quantity <= 0) {
        setCart((prev) => prev.filter((c) => !(c.productId === item.productId && c.variantId === item.variantId)));
      } else {
        setCart((prev) =>
          prev.map((c) =>
            c.productId === item.productId && c.variantId === item.variantId
              ? { ...c, quantity: Math.min(quantity, item.availableStock) }
              : c
          )
        );
      }
    },
    [notify]
  );

  const removeCartItem = useCallback(async (item: CartItem) => {
    if (tokenRef.current) {
      const res = await fetch(`/api/cart/items/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.items || []);
      }
      return;
    }
    setCart((prev) => prev.filter((c) => !(c.productId === item.productId && c.variantId === item.variantId)));
  }, []);

  const clearLocalCartAfterOrder = useCallback(() => {
    setCart([]);
    setAppliedCouponCode('');
    localStorage.removeItem('aagaman_guest_cart');
  }, []);

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!tokenRef.current) {
        setIsAuthModalOpen(true);
        notify('Please sign in to save items to your Wishlist.', 'info');
        return;
      }
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ productId: product.id }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.wished) {
          setWishlistProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
          notify('Saved to Wishlist.', 'success');
        } else {
          setWishlistProducts((prev) => prev.filter((p) => p.id !== product.id));
          notify('Removed from Wishlist.', 'info');
        }
      }
    },
    [notify]
  );

  const moveWishlistToCart = useCallback(
    async (productId: number) => {
      if (!tokenRef.current) return;
      const res = await fetch(`/api/wishlist/${productId}/move-to-cart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.items || []);
        setWishlistProducts((prev) => prev.filter((p) => p.id !== productId));
        notify('Moved item from Wishlist to Cart.', 'success');
      } else {
        const err = await res.json();
        notify(err.error || 'Could not move item.', 'error');
      }
    },
    [notify]
  );

  const recordProductView = useCallback((product: Product) => {
    setRecentlyViewed((prev) => {
      const next = [product, ...prev.filter((p) => p.id !== product.id)].slice(0, 6);
      try {
        localStorage.setItem('aagaman_recent_viewed', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleCompare = useCallback(
    (product: Product) => {
      setCompareProducts((prev) => {
        if (prev.some((p) => p.id === product.id)) {
          return prev.filter((p) => p.id !== product.id);
        }
        if (prev.length >= 3) {
          notify('You can compare up to 3 products at once.', 'info');
          return prev;
        }
        notify(`Added "${product.name}" to comparison.`, 'success');
        return [...prev, product];
      });
    },
    [notify]
  );

  const clearCompare = useCallback(() => setCompareProducts([]), []);

  const addRecentSearch = useCallback((q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem('aagaman_recent_searches', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartSubtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartSavings = cart.reduce((sum, i) => sum + Math.max(0, i.mrp - i.unitPrice) * i.quantity, 0);
  const wishlistIds = wishlistProducts.map((p) => p.id);

  return (
    <StoreContext.Provider
      value={{
        route,
        navigate,
        backendUnavailable,
        config,
        paymentMode,
        razorpayKeyId,
        publicCoupons,
        categories,
        user,
        authToken,
        authLoading,
        setCustomerSession,
        refreshUser,
        logoutCustomer,
        cart,
        cartCount,
        cartSubtotal,
        cartSavings,
        addToCart,
        updateCartQty,
        removeCartItem,
        clearLocalCartAfterOrder,
        reloadCart,
        wishlistIds,
        wishlistProducts,
        toggleWishlist,
        moveWishlistToCart,
        recentlyViewed,
        recordProductView,
        compareProducts,
        toggleCompare,
        clearCompare,
        recentSearches,
        addRecentSearch,
        appliedCouponCode,
        setAppliedCouponCode,
        isCartOpen,
        setIsCartOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isCompareOpen,
        setIsCompareOpen,
        notify,
        refreshStoreMeta,
      }}
    >
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
              t.type === 'error'
                ? 'bg-red-950 text-white border-red-800'
                : t.type === 'success'
                ? 'bg-[#0B1F3A] text-white border-orange-500/40'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
