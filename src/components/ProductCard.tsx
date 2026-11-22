import React from 'react';
import { ArrowRightLeft, Heart, ShoppingCart, Star, Package } from 'lucide-react';
import { formatINR, useStore } from '../context/StoreContext';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { navigate, addToCart, wishlistIds, toggleWishlist, compareProducts, toggleCompare } =
    useStore();

  const primaryImage =
    product.images?.find((img) => img.isPrimary)?.imageUrl || product.images?.[0]?.imageUrl || '';
  const isWished = wishlistIds.includes(product.id);
  const isCompared = compareProducts.some((p) => p.id === product.id);
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Studio Image Area (4:3) */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <a
          href={`/product/${product.slug}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/product/${product.slug}`);
          }}
          className="block w-full h-full"
        >
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center">
              <Package className="w-8 h-8 mb-1.5" />
              <span className="text-xs font-medium text-slate-500 line-clamp-1">{product.name}</span>
            </div>
          )}
        </a>

        {/* Quick Actions (Wishlist & Compare) */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            aria-label={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border transition-colors ${
              isWished
                ? 'bg-[#EA580C] text-white border-[#EA580C]'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-[#EA580C]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => toggleCompare(product)}
            aria-label="Compare product"
            title="Compare product"
            className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border transition-colors ${
              isCompared
                ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-[#0B1F3A]'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Product Metadata & Actions */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700 truncate">{product.brand}</span>
            {product.category?.name && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{product.category.name}</span>
              </>
            )}
          </div>

          <a
            href={`/product/${product.slug}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/product/${product.slug}`);
            }}
            className="block font-display text-[15px] font-semibold text-[#0B1F3A] leading-snug line-clamp-2 hover:text-[#EA580C] transition-colors"
          >
            {product.name}
          </a>

          <div className="flex items-center gap-2 text-xs text-slate-600 pt-0.5">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {product.ratingAvg}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{product.ratingCount} reviews</span>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-[#0B1F3A] tabular-nums">
                {formatINR(product.sellingPrice)}
              </span>
              {product.mrp > product.sellingPrice && (
                <span className="font-mono text-xs text-slate-400 line-through tabular-nums">
                  {formatINR(product.mrp)}
                </span>
              )}
            </div>
            {product.discountPercent > 0 && (
              <span className="text-xs font-semibold text-[#EA580C] tabular-nums">
                {product.discountPercent}% off
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            {isOutOfStock ? (
              <span className="font-semibold text-red-600">Out of Stock</span>
            ) : isLowStock ? (
              <span className="font-semibold text-amber-700">Only {product.stock} left in stock</span>
            ) : (
              <span className="text-emerald-700 font-medium">In Stock · Free Delivery Eligible</span>
            )}
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={() => addToCart(product)}
            className={`w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#EA580C] hover:bg-[#C2410C] text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{isOutOfStock ? 'Unavailable' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
