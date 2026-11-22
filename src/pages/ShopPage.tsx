import React, { useEffect, useState } from 'react';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useStore } from '../context/StoreContext';
import type { Product } from '../types';

export const ShopPage: React.FC = () => {
  const { route, categories, navigate } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Derive initial category or query from URL
  const pathParts = route.split('?')[0].split('/').filter(Boolean);
  const urlCategorySlug = pathParts[0] === 'category' ? pathParts[1] : 'all';
  const searchParams = new URLSearchParams(route.split('?')[1] || '');
  const urlQ = searchParams.get('q') || '';
  const urlFlag = searchParams.get('flag') || '';

  const [selectedCategory, setSelectedCategory] = useState(urlCategorySlug || 'all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [minDiscount, setMinDiscount] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('popular');

  useEffect(() => {
    setSelectedCategory(urlCategorySlug || 'all');
  }, [urlCategorySlug]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (urlQ) params.set('q', urlQ);
      if (urlFlag) params.set('flag', urlFlag);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedBrand && selectedBrand !== 'all') params.set('brand', selectedBrand);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (minRating > 0) params.set('minRating', String(minRating));
      if (minDiscount > 0) params.set('minDiscount', String(minDiscount));
      if (inStockOnly) params.set('inStock', 'true');
      params.set('sort', sort);

      try {
        const res = await fetch(`/api/products?${params.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          setProducts(json.products || []);
          setBrands(json.brands || []);
        }
      } catch {
        // ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [urlQ, urlFlag, selectedCategory, selectedBrand, minPrice, maxPrice, minRating, minDiscount, inStockOnly, sort]);

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setMinPrice('');
    setMaxPrice('');
    setMinRating(0);
    setMinDiscount(0);
    setInStockOnly(false);
    setSort('popular');
    navigate('/shop');
  };

  const filterPanel = (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <span className="font-display font-bold text-[#0B1F3A] flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#EA580C]" /> Filters
        </span>
        <button type="button" onClick={resetFilters} className="text-xs text-[#EA580C] font-semibold hover:underline">
          Reset All
        </button>
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Category</p>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              navigate('/shop');
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'all' ? 'bg-[#0B1F3A] text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.slug);
                navigate(`/category/${cat.slug}`);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex justify-between transition-colors ${
                selectedCategory === cat.slug ? 'bg-[#0B1F3A] text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="truncate">{cat.name}</span>
              <span className="opacity-70 tabular-nums">{cat.productCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Price Range (₹)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min ₹"
            className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
          />
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max ₹"
            className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
          />
        </div>
      </div>

      {/* Brand */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Brand</p>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
        >
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Customer Rating</p>
        <div className="space-y-1">
          {[4.5, 4, 3, 0].map((r) => (
            <label key={r} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="ratingFilter"
                checked={minRating === r}
                onChange={() => setMinRating(r)}
                className="accent-[#EA580C]"
              />
              <span>{r === 0 ? 'All Ratings' : `${r}★ & above`}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Discount */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Discount</p>
        <div className="space-y-1">
          {[40, 25, 10, 0].map((d) => (
            <label key={d} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="discountFilter"
                checked={minDiscount === d}
                onChange={() => setMinDiscount(d)}
                className="accent-[#EA580C]"
              />
              <span>{d === 0 ? 'Any Discount' : `${d}% Off or more`}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Stock */}
      <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer pt-2 border-t border-slate-200">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="accent-[#EA580C] w-4 h-4"
        />
        <span>Exclude Out of Stock</span>
      </label>
    </div>
  );

  return (
    <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Category / Search Banner */}
      <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#FDBA74] font-semibold uppercase tracking-wider">
            AAGAMAN MART Catalog
          </p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold mt-1">
            {urlQ
              ? `Search results for "${urlQ}"`
              : activeCategoryObj
              ? activeCategoryObj.name
              : urlFlag === 'deal'
              ? 'Top Deals of the Day'
              : 'All Marketplace Products'}
          </h1>
          {activeCategoryObj?.description && (
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">{activeCategoryObj.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="h-10 px-3 rounded-lg bg-white text-slate-900 text-xs font-semibold focus:outline-none"
          >
            <option value="popular">Sort: Popularity</option>
            <option value="newest">Sort: Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Customer Rating</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 sticky top-32">
          {filterPanel}
        </aside>

        {/* Results Grid */}
        <section className="lg:col-span-9 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="tabular-nums">
              Showing <strong className="text-[#0B1F3A]">{products.length}</strong> products
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-96 rounded-xl bg-slate-200/70 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <p className="font-display text-lg font-bold text-[#0B1F3A]">No matching products found</p>
              <p className="text-sm text-slate-500">
                Try adjusting your price range, category, or search keywords.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-5 py-2.5 rounded-lg bg-[#EA580C] text-white text-sm font-semibold"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Mobile Filters Slide-over */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex justify-end">
          <div className="w-80 bg-white h-full p-5 overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}
    </main>
  );
};
