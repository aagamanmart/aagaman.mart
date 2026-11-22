import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  Heart,
  MapPin,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { formatINR, useStore } from '../context/StoreContext';
import type { Product, ProductVariant, Review } from '../types';

export const ProductDetailPage: React.FC<{ slug: string }> = ({ slug }) => {
  const {
    navigate,
    addToCart,
    wishlistIds,
    toggleWishlist,
    toggleCompare,
    recordProductView,
    authToken,
    setIsAuthModalOpen,
    notify,
  } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);

  // Pincode check
  const [pincode, setPincode] = useState('400051');
  const [pincodeResult, setPincodeResult] = useState<{
    region: string;
    courierPartner: string;
    estimatedDelivery: string;
    codAvailable: boolean;
  } | null>(null);
  const [pincodeErr, setPincodeErr] = useState('');

  // Review Form
  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          setProduct(null);
          return;
        }
        const json = await res.json();
        setProduct(json.product);
        setReviews(json.reviews || []);
        setRelated(json.relatedProducts || []);
        setSelectedVariant(json.product.variants?.[0] || null);
        setActiveImgIdx(0);
        recordProductView(json.product);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, recordProductView]);

  const checkPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPincodeErr('');
    const res = await fetch(`/api/pincode/${encodeURIComponent(pincode.trim())}`);
    const json = await res.json();
    if (!res.ok) {
      setPincodeErr(json.error || 'Not serviceable');
      setPincodeResult(null);
    } else {
      setPincodeResult(json);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) {
      setIsAuthModalOpen(true);
      notify('Please sign in to post a product review.', 'info');
      return;
    }
    if (!product) return;
    setSubmittingRev(true);
    try {
      const res = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ rating: revRating, title: revTitle, comment: revComment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit review');
      setReviews((prev) => [json.review, ...prev]);
      setProduct((p) => (p ? { ...p, ratingAvg: json.ratingAvg, ratingCount: json.ratingCount } : p));
      setRevTitle('');
      setRevComment('');
      notify('Thank you! Your review has been published.', 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Review error', 'error');
    } finally {
      setSubmittingRev(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12">
        <div className="h-[520px] rounded-2xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Product Not Found</h1>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-2.5 rounded-lg bg-[#EA580C] text-white text-sm font-semibold"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  const images = product.images || [];
  const activeImage = images[activeImgIdx]?.imageUrl || images[0]?.imageUrl || '';
  const unitPrice = product.sellingPrice + (selectedVariant?.priceAdjustment || 0);
  const mrpPrice = product.mrp + (selectedVariant?.priceAdjustment || 0);
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isWished = wishlistIds.includes(product.id);
  const bundlePartner = related[0] || null;

  return (
    <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 space-y-14">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate('/')} className="hover:text-[#EA580C]">
          Home
        </button>
        <span>/</span>
        {product.category && (
          <>
            <button onClick={() => navigate(`/category/${product.category!.slug}`)} className="hover:text-[#EA580C]">
              {product.category.name}
            </button>
            <span>/</span>
          </>
        )}
        <span className="text-slate-800 font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Contiguous PDP Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Interactive Image Gallery + Magnifier Zoom */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-32">
          <div
            className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-zoom-in"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setZoomOrigin({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
            onMouseLeave={() => setZoomOrigin(null)}
          >
            <img
              src={activeImage}
              alt={product.name}
              referrerPolicy="no-referrer"
              style={
                zoomOrigin
                  ? {
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                      transform: 'scale(1.65)',
                    }
                  : undefined
              }
              className="w-full h-full object-cover transition-transform duration-150"
            />
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  className={`w-24 aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors shrink-0 ${
                    idx === activeImgIdx ? 'border-[#EA580C]' : 'border-slate-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.altText || product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="space-y-2 border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {product.brand} · SKU <span className="font-mono">{selectedVariant?.sku || product.sku}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  notify('Product link copied to clipboard.', 'success');
                }}
                className="inline-flex items-center gap-1 hover:text-[#EA580C]"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#0B1F3A] leading-tight">
              {product.name}
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-[#0B1F3A]">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {product.ratingAvg}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 tabular-nums">{product.ratingCount} verified ratings</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 tabular-nums">{product.soldCount}+ sold</span>
            </div>
          </div>

          {/* Pricing Block */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold text-[#0B1F3A] tabular-nums">
                {formatINR(unitPrice)}
              </span>
              {mrpPrice > unitPrice && (
                <span className="font-mono text-base text-slate-400 line-through tabular-nums">
                  {formatINR(mrpPrice)}
                </span>
              )}
              {product.discountPercent > 0 && (
                <span className="text-sm font-bold text-[#EA580C] tabular-nums">
                  Save {product.discountPercent}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Inclusive of {product.gstPercent}% GST · Eligible for GST Business Tax Invoice
            </p>
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Select Option / Variant</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors ${
                        active
                          ? 'border-[#EA580C] bg-orange-50 text-[#0B1F3A]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/15"
                        style={{ backgroundColor: v.colorHex }}
                      />
                      <span>
                        {v.color} · {v.size}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock & Quantity + Primary CTAs */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs">
              {availableStock <= 0 ? (
                <span className="font-semibold text-red-600">Currently Out of Stock</span>
              ) : availableStock <= 5 ? (
                <span className="font-semibold text-amber-700">Hurry — only {availableStock} left in stock!</span>
              ) : (
                <span className="font-semibold text-emerald-700">In Stock ({availableStock} units ready to ship)</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center border border-slate-300 rounded-lg h-11">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 h-full text-slate-700 hover:bg-slate-100 rounded-l-lg font-bold"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(availableStock || 1, q + 1))}
                  className="px-3 h-full text-slate-700 hover:bg-slate-100 rounded-r-lg font-bold"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={availableStock <= 0}
                onClick={() => addToCart(product, selectedVariant, qty)}
                className="flex-1 min-w-[160px] h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" /> Add to Cart
              </button>

              <button
                type="button"
                disabled={availableStock <= 0}
                onClick={async () => {
                  const ok = await addToCart(product, selectedVariant, qty);
                  if (ok) navigate('/checkout');
                }}
                className="flex-1 min-w-[140px] h-11 rounded-lg bg-[#0B1F3A] hover:bg-[#102A43] text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className={`flex-1 h-10 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  isWished
                    ? 'border-[#EA580C] bg-orange-50 text-[#EA580C]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
                {isWished ? 'Saved in Wishlist' : 'Add to Wishlist'}
              </button>
              <button
                type="button"
                onClick={() => toggleCompare(product)}
                className="flex-1 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" /> Compare
              </button>
            </div>
          </div>

          {/* Pincode Delivery Checker */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <p className="text-xs font-semibold text-[#0B1F3A] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#EA580C]" /> Check Delivery & COD Availability
            </p>
            <form onSubmit={checkPincode} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit pincode"
                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
              />
              <button
                type="submit"
                className="px-4 h-9 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
              >
                Check
              </button>
            </form>
            {pincodeErr && <p className="text-xs text-red-600">{pincodeErr}</p>}
            {pincodeResult && (
              <div className="text-xs text-slate-700 space-y-0.5">
                <p className="font-semibold text-emerald-700 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Estimated delivery by {pincodeResult.estimatedDelivery}
                </p>
                <p className="text-slate-500">
                  {pincodeResult.region} · {pincodeResult.courierPartner} ·{' '}
                  {pincodeResult.codAvailable ? 'Cash on Delivery Available' : 'Prepaid Only'}
                </p>
              </div>
            )}
          </div>

          {/* Trust & Return Policy */}
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
              <span>{product.returnPolicy}</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
              <span>100% Genuine Product · Razorpay Buyer Protection</span>
            </div>
          </div>
        </div>
      </section>

      {/* Description, Specifications & Frequently Bought Together */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Product Overview</h2>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{product.description}</p>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-[#0B1F3A] mb-3">Technical Specifications</h3>
            <dl className="divide-y divide-slate-100 border-y border-slate-100 text-sm">
              {Object.entries(product.specifications || {}).map(([k, v]) => (
                <div key={k} className="py-2.5 grid grid-cols-3 gap-4">
                  <dt className="text-slate-500 font-medium">{k}</dt>
                  <dd className="col-span-2 text-slate-900 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Frequently Bought Together */}
        {bundlePartner && (
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 flex flex-col justify-between space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Frequently Bought Together</h2>
              <p className="text-xs text-slate-500 mt-1">Complete your setup in a single checkout.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <img
                  src={activeImage}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[4/3] object-cover rounded-lg mb-2"
                />
                <p className="text-xs font-semibold text-[#0B1F3A] line-clamp-1">{product.name}</p>
                <p className="font-mono text-xs font-bold text-[#EA580C] tabular-nums">{formatINR(unitPrice)}</p>
              </div>
              <span className="font-bold text-slate-400 text-lg">+</span>
              <div className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <img
                  src={bundlePartner.images?.[0]?.imageUrl}
                  alt={bundlePartner.name}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[4/3] object-cover rounded-lg mb-2"
                />
                <p className="text-xs font-semibold text-[#0B1F3A] line-clamp-1">{bundlePartner.name}</p>
                <p className="font-mono text-xs font-bold text-[#EA580C] tabular-nums">
                  {formatINR(bundlePartner.sellingPrice)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await addToCart(product, selectedVariant, 1);
                await addToCart(bundlePartner, null, 1);
              }}
              className="w-full h-11 rounded-lg bg-[#0B1F3A] hover:bg-[#102A43] text-white text-sm font-semibold transition-colors"
            >
              Add Both to Cart · {formatINR(unitPrice + bundlePartner.sellingPrice)}
            </button>
          </div>
        )}
      </section>

      {/* Customer Reviews */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Write a Customer Review</h2>
          <form onSubmit={handleReviewSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Rating</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRevRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= revRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              value={revTitle}
              onChange={(e) => setRevTitle(e.target.value)}
              placeholder="Review headline"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
            <textarea
              required
              rows={3}
              value={revComment}
              onChange={(e) => setRevComment(e.target.value)}
              placeholder="Share your experience with quality, delivery, and packaging..."
              className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
            <button
              type="submit"
              disabled={submittingRev}
              className="w-full h-10 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold"
            >
              {submittingRev ? 'Submitting...' : 'Post Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
            Verified Customer Reviews ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
              Be the first customer to review this product.
            </p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1F3A]">{r.title}</h3>
                  </div>
                  {r.isVerifiedPurchase && (
                    <span className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified Purchase
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{r.comment}</p>
                <p className="text-xs text-slate-500">
                  {r.authorName} · {new Date(r.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">Related Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
