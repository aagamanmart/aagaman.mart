import React from 'react';
import { ShoppingCart, Star, Trash2, X } from 'lucide-react';
import { formatINR, useStore } from '../context/StoreContext';

export const CompareModal: React.FC = () => {
  const { isCompareOpen, setIsCompareOpen, compareProducts, toggleCompare, clearCompare, addToCart } =
    useStore();

  if (!isCompareOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[88vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            Product Comparison ({compareProducts.length}/3)
          </h2>
          <div className="flex items-center gap-3">
            {compareProducts.length > 0 && (
              <button
                type="button"
                onClick={clearCompare}
                className="text-xs text-slate-300 hover:text-white underline"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCompareOpen(false)}
              className="p-1 rounded hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-x-auto overflow-y-auto">
          {compareProducts.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-sm">
              Select up to 3 products using the compare button on any product card.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 pr-4 text-slate-500 font-medium w-40">Feature</th>
                  {compareProducts.map((p) => {
                    const img = p.images?.find((i) => i.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl;
                    return (
                      <th key={p.id} className="text-left py-3 px-4 align-top w-60">
                        <div className="relative">
                          <img
                            src={img}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-36 object-cover rounded-lg bg-slate-100 mb-2"
                          />
                          <button
                            type="button"
                            onClick={() => toggleCompare(p)}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-white/90 text-slate-700 hover:text-red-600 shadow"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-display font-semibold text-[#0B1F3A] line-clamp-2">{p.name}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 pr-4 font-medium text-slate-500">Selling Price</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono font-bold text-[#0B1F3A] tabular-nums">
                      {formatINR(p.sellingPrice)}{' '}
                      <span className="text-xs font-normal text-[#EA580C]">({p.discountPercent}% off)</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-slate-500">Brand</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-slate-800">{p.brand}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-slate-500">Rating</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {p.ratingAvg} ({p.ratingCount})
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-slate-500">Availability</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-4">
                      {p.stock > 0 ? (
                        <span className="text-emerald-700 font-medium">{p.stock} in stock</span>
                      ) : (
                        <span className="text-red-600 font-medium">Out of stock</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-slate-500">Return Policy</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-xs text-slate-600">{p.returnPolicy}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-slate-500">Specifications</td>
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-xs text-slate-600 space-y-1 align-top">
                      {Object.entries(p.specifications || {}).map(([k, v]) => (
                        <div key={k}>
                          <strong className="text-slate-800">{k}:</strong> {v}
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-4 pr-4" />
                  {compareProducts.map((p) => (
                    <td key={p.id} className="py-4 px-4">
                      <button
                        type="button"
                        disabled={p.stock <= 0}
                        onClick={() => addToCart(p)}
                        className="w-full h-9 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
