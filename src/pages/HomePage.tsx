import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Mail, Star, Tag } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { formatINR, useStore } from '../context/StoreContext';
import type { Product } from '../types';

export const HomePage: React.FC = () => {
  const { config, categories, publicCoupons, navigate, recentlyViewed, notify } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeShelf, setActiveShelf] = useState<'bestseller' | 'new' | 'trending' | 'offers' | 'recommended'>(
    'bestseller'
  );
  const [countdown, setCountdown] = useState({ hrs: '35', min: '59', sec: '59' });
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNews, setSubmittingNews] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/products?limit=40');
        if (res.ok) {
          const json = await res.json();
          setProducts(json.products || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const banners = config?.banners || [];

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % banners.length);
    }, 6000);
    return () => clearInterval(id);
  }, [banners.length]);

  useEffect(() => {
    const endMs = config?.flashSaleEndsAt
      ? new Date(config.flashSaleEndsAt).getTime()
      : Date.now() + 36 * 3600 * 1000;
    const tick = () => {
      const diff = Math.max(0, endMs - Date.now());
      const hrs = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const min = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const sec = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setCountdown({ hrs, min, sec });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [config?.flashSaleEndsAt]);

  const dealsOfDay = products.filter((p) => p.isDealOfDay).slice(0, 4);
  const shelfProducts = (() => {
    if (activeShelf === 'bestseller') return products.filter((p) => p.isBestSeller).slice(0, 8);
    if (activeShelf === 'new') return products.filter((p) => p.isNewArrival).slice(0, 8);
    if (activeShelf === 'trending') return products.filter((p) => p.isTrending).slice(0, 8);
    if (activeShelf === 'offers')
      return [...products].sort((a, b) => b.discountPercent - a.discountPercent).slice(0, 8);
    return products.filter((p) => p.isFeatured).slice(0, 8);
  })();

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubmittingNews(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const json = await res.json();
      if (!res.ok) notify(json.error || 'Subscription failed.', 'error');
      else {
        notify(json.message, 'success');
        setNewsletterEmail('');
      }
    } finally {
      setSubmittingNews(false);
    }
  };

  return (
    <main className="space-y-14 pb-12">
      {/* 1. Promotional Hero Slider */}
      <section className="relative bg-[#0B1F3A] text-white overflow-hidden">
        <div className="max-w-[1440px] mx-auto relative">
          {banners.length > 0 && (
            <div className="relative min-h-[380px] lg:min-h-[480px] flex items-center">
              <img
                src={banners[heroIndex]?.imageUrl}
                alt={banners[heroIndex]?.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/75 to-[#0B1F3A]/20" />

              <div className="relative z-10 px-6 lg:px-14 py-14 max-w-2xl space-y-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FDBA74]">
                  {banners[heroIndex]?.kicker}
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-balance">
                  {banners[heroIndex]?.title}
                </h1>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
                  {banners[heroIndex]?.subtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/category/${banners[heroIndex]?.categorySlug}`)}
                    className="px-6 py-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>{banners[heroIndex]?.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/shop')}
                    className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-colors whitespace-nowrap"
                  >
                    Explore All Products
                  </button>
                </div>
              </div>

              {banners.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous slide"
                    onClick={() => setHeroIndex((i) => (i - 1 + banners.length) % banners.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next slide"
                    onClick={() => setHeroIndex((i) => (i + 1) % banners.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-5 left-6 lg:left-14 z-20 flex gap-2">
                    {banners.map((b, idx) => (
                      <button
                        key={b.id}
                        type="button"
                        aria-label={`Slide ${idx + 1}`}
                        onClick={() => setHeroIndex(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === heroIndex ? 'w-8 bg-[#EA580C]' : 'w-3 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. Grand Aagaman Sale & Top Deals of the Day */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold text-[#EA580C] uppercase tracking-wider">
              {config?.flashSaleTitle || 'Grand Aagaman Sale'} · Top Deals of the Day
            </p>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#0B1F3A] mt-1">
              Limited-Time Flagship Markdowns
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {config?.flashSaleSubtitle || 'Direct savings across verified electronics, footwear, and appliances.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded-lg text-xs">
              <Clock className="w-4 h-4 text-[#F97316]" />
              <span className="text-slate-300">Ends in</span>
              <span className="font-mono font-bold text-sm tabular-nums">
                {countdown.hrs}:{countdown.min}:{countdown.sec}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/shop?flag=deal')}
              className="text-sm font-semibold text-[#EA580C] hover:text-[#C2410C] flex items-center gap-1 whitespace-nowrap"
            >
              <span>View all deals</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-96 rounded-xl bg-slate-200/70 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {dealsOfDay.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Active Offers Strip */}
        {publicCoupons.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {publicCoupons.slice(0, 3).map((c) => (
              <div
                key={c.code}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold text-[#0B1F3A]">{c.code}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{c.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(c.code);
                    notify(`Copied coupon code ${c.code}`, 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#EA580C] text-xs font-semibold text-[#0B1F3A] whitespace-nowrap shrink-0"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Shop by Categories (All 16 Categories) */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#0B1F3A]">
              Shop by Categories
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Explore 16 curated departments across daily groceries, tech, fashion, and home living.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="text-sm font-semibold text-[#EA580C] hover:text-[#C2410C] whitespace-nowrap"
          >
            Browse Catalog →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/category/${cat.slug}`)}
              className="group bg-white border border-slate-200 hover:border-[#EA580C] rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col"
            >
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-100 mb-2.5">
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <p className="font-display text-xs font-semibold text-[#0B1F3A] line-clamp-2 leading-snug">
                {cat.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-auto pt-1 tabular-nums">
                {cat.productCount} items
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Curated Discovery Shelf (Best Sellers / New Arrivals / Trending / Offers / Recommended) */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#0B1F3A]">
            Marketplace Collections
          </h2>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto no-scrollbar">
            {[
              { key: 'bestseller', label: 'Best Selling' },
              { key: 'new', label: 'New Arrivals' },
              { key: 'trending', label: 'Trending' },
              { key: 'offers', label: 'Special Offers' },
              { key: 'recommended', label: 'Recommended' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveShelf(tab.key as typeof activeShelf)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeShelf === tab.key
                    ? 'bg-[#0B1F3A] text-white shadow-sm'
                    : 'text-slate-700 hover:text-[#0B1F3A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {shelfProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Recently Viewed Strip (when populated) */}
      {recentlyViewed.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-5">
          <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Recently Viewed</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recentlyViewed.map((p) => {
              const img = p.images?.find((i) => i.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/product/${p.slug}`)}
                  className="bg-white border border-slate-200 rounded-xl p-3 text-left hover:border-[#EA580C] transition-colors"
                >
                  <img
                    src={img}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover rounded-lg bg-slate-100 mb-2"
                  />
                  <p className="text-xs font-semibold text-[#0B1F3A] line-clamp-1">{p.name}</p>
                  <p className="font-mono text-xs font-bold text-[#EA580C] mt-1 tabular-nums">
                    {formatINR(p.sellingPrice)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Verified Customer Reviews & Newsletter */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">
              Trusted by Indian Shoppers
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Verified feedback from recent orders delivered across Mumbai, Bengaluru, and Delhi NCR.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                name: 'Ananya Deshmukh',
                role: 'Architect, Pune',
                quote:
                  'Switched our studio kitchen appliances and pantry supplies to AAGAMAN MART. Next-day Maharashtra delivery and clean GST invoices make accounting effortless.',
              },
              {
                name: 'Rohan Kulkarni',
                role: 'Software Engineer, Bengaluru',
                quote:
                  'Ordered the Aurora Pro ANC headphones during the Grand Aagaman Sale via UPI. Verified sealed unit arrived in 24 hours with 10% instant coupon savings.',
              },
            ].map((t) => (
              <div key={t.name} className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="text-xs">
                  <p className="font-semibold text-[#0B1F3A]">{t.name}</p>
                  <p className="text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter Subscription */}
        <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 lg:p-8 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#EA580C] flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-display text-2xl font-bold">Get Early Access & Sale Alerts</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Receive curated restock notices, festive sale coupons, and member-only markdowns directly in your inbox.
            </p>
          </div>
          <form onSubmit={handleNewsletter} className="space-y-2.5">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full h-11 px-4 rounded-lg bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
            <button
              type="submit"
              disabled={submittingNews}
              className="w-full h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm transition-colors"
            >
              {submittingNews ? 'Subscribing...' : 'Subscribe Now'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
