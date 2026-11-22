import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { formatINR, useStore } from '../context/StoreContext';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    cartCount,
    cartSubtotal,
    cartSavings,
    updateCartQty,
    removeCartItem,
    appliedCouponCode,
    setAppliedCouponCode,
    publicCoupons,
    config,
    navigate,
    authToken,
    notify,
  } = useStore();

  const [couponInput, setCouponInput] = useState(appliedCouponCode || '');
  const [couponFeedback, setCouponFeedback] = useState<{ ok: boolean; msg: string; discount: number } | null>(
    null
  );

  if (!isCartOpen) return null;

  const freeShippingThreshold = config?.freeShippingThreshold || 999;
  const remainingForFreeShip = Math.max(0, freeShippingThreshold - cartSubtotal);
  const shippingEstimate = cartSubtotal === 0 ? 0 : remainingForFreeShip === 0 ? 0 : config?.standardShippingCharge || 49;

  const applyCoupon = async (codeToTry: string) => {
    const clean = codeToTry.trim().toUpperCase();
    if (!clean) return;
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        code: clean,
        subtotal: cartSubtotal,
        categoryIds: cart.map((i) => i.categoryId),
        productIds: cart.map((i) => i.productId),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setCouponFeedback({ ok: false, msg: json.error || 'Invalid coupon', discount: 0 });
    } else {
      setAppliedCouponCode(json.coupon.code);
      setCouponInput(json.coupon.code);
      setCouponFeedback({
        ok: true,
        msg: json.coupon.freeShipping
          ? `${json.coupon.code} applied — Free Shipping unlocked!`
          : `${json.coupon.code} applied — Save ${formatINR(json.coupon.discountAmount)}`,
        discount: json.coupon.discountAmount || 0,
      });
      notify(`Coupon ${json.coupon.code} applied!`, 'success');
    }
  };

  const couponDiscount = couponFeedback?.ok ? couponFeedback.discount : 0;
  const payable = Math.max(0, cartSubtotal - couponDiscount + shippingEstimate);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-5 py-4 bg-[#0B1F3A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#F97316]" />
            <h2 className="font-display text-lg font-bold">Shopping Cart ({cartCount})</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close cart"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress */}
        {cart.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
            {remainingForFreeShip > 0 ? (
              <p className="text-slate-700">
                Add <span className="font-mono font-bold text-[#EA580C]">{formatINR(remainingForFreeShip)}</span> more for{' '}
                <span className="font-semibold">FREE Standard Delivery</span>.
              </p>
            ) : (
              <p className="text-emerald-700 font-semibold">
                Your order qualifies for FREE Pan-India Standard Delivery.
              </p>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="font-display text-lg font-semibold text-[#0B1F3A]">Your cart is empty</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">
                Explore groceries, electronics, fashion, and home appliances on AAGAMAN MART.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/shop');
                }}
                className="mt-5 px-5 py-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold transition-colors"
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={`${item.productId}-${item.variantId ?? 'std'}`}
                className="flex gap-3.5 pb-4 border-b border-slate-100"
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-lg object-cover bg-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartOpen(false);
                        navigate(`/product/${item.slug}`);
                      }}
                      className="text-sm font-semibold text-[#0B1F3A] hover:text-[#EA580C] text-left line-clamp-2"
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCartItem(item)}
                      aria-label="Remove item"
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.brand} · {item.variantLabel}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-l-lg"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono text-xs font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-r-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-[#0B1F3A] tabular-nums">
                        {formatINR(item.unitPrice * item.quantity)}
                      </span>
                      {item.mrp > item.unitPrice && (
                        <span className="block font-mono text-[11px] text-slate-400 line-through tabular-nums">
                          {formatINR(item.mrp * item.quantity)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary & Checkout */}
        {cart.length > 0 && (
          <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3.5">
            {/* Coupon Box */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Coupon code (e.g. AAGAMAN10)"
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => applyCoupon(couponInput)}
                  className="px-3.5 h-9 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold hover:bg-[#102A43]"
                >
                  Apply
                </button>
              </div>
              {couponFeedback && (
                <p className={`text-xs font-medium ${couponFeedback.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                  {couponFeedback.msg}
                </p>
              )}
              {publicCoupons.length > 0 && !couponFeedback?.ok && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {publicCoupons.slice(0, 3).map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => applyCoupon(c.code)}
                      className="text-[11px] font-mono font-semibold text-[#EA580C] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded hover:bg-orange-100"
                    >
                      Use {c.code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1 text-sm border-t border-slate-200 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (incl. GST)</span>
                <span className="font-mono tabular-nums">{formatINR(cartSubtotal)}</span>
              </div>
              {cartSavings > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs font-medium">
                  <span>MRP Product Savings</span>
                  <span className="font-mono tabular-nums">-{formatINR(cartSavings)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs font-medium">
                  <span>Coupon ({appliedCouponCode})</span>
                  <span className="font-mono tabular-nums">-{formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 text-xs">
                <span>Estimated Shipping</span>
                <span className="font-mono tabular-nums">
                  {shippingEstimate === 0 ? 'FREE' : formatINR(shippingEstimate)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#0B1F3A] pt-1.5 border-t border-slate-200">
                <span>Total Payable</span>
                <span className="font-mono tabular-nums">{formatINR(payable)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCartOpen(false);
                navigate('/checkout');
              }}
              className="w-full h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
