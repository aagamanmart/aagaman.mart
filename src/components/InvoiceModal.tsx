import React from 'react';
import { Printer, X } from 'lucide-react';
import { formatINR } from '../context/StoreContext';
import type { OrderRecord } from '../types';

interface InvoiceModalProps {
  order: OrderRecord | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Tax Invoice · {order.orderNumber}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div id="printable-gst-invoice" className="p-8 text-slate-900 space-y-6 text-sm">
          <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#0B1F3A]">AAGAMAN MART</h2>
              <p className="text-xs text-slate-500 mt-0.5">Quality That Moves You Forward.</p>
              <p className="text-xs text-slate-600 mt-2">
                Aagaman Commerce Tower, Bandra Kurla Complex, Mumbai 400051
                <br />
                GSTIN: 27AABCA9876K1Z5 · Email: support@aagamanmart.in
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-500 uppercase">Tax Invoice</p>
              <p className="font-mono font-bold text-base text-[#0B1F3A]">{order.orderNumber}</p>
              <p className="text-xs text-slate-600 mt-1">
                Date: {new Date(order.createdAt).toLocaleDateString('en-IN')}
                <br />
                Payment: {order.paymentMethod.toUpperCase()} ({order.paymentStatus.toUpperCase()})
                {order.payment?.razorpayPaymentId && (
                  <>
                    <br />
                    Txn ID: {order.payment.razorpayPaymentId}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Billed & Shipped To</p>
              <p className="font-semibold text-[#0B1F3A]">{order.addressSnapshot.fullName}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {order.addressSnapshot.line1}
                {order.addressSnapshot.line2 ? `, ${order.addressSnapshot.line2}` : ''}
                <br />
                {order.addressSnapshot.city}, {order.addressSnapshot.state} - {order.addressSnapshot.pincode}
                <br />
                Phone: {order.addressSnapshot.phone}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Shipping Info</p>
              <p className="text-xs text-slate-700">
                Method: {order.shippingMethod}
                <br />
                Courier: {order.shipping?.courierPartner || 'Delhivery Express'}
                <br />
                Tracking: <span className="font-mono">{order.shipping?.trackingNumber || 'Pending'}</span>
              </p>
            </div>
          </div>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-slate-700">
                <th className="py-2.5 px-3 text-left">Item & SKU</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">GST %</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-900">{item.productName}</p>
                    <p className="text-slate-500 font-mono">
                      {item.sku} · {item.variantLabel}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(item.unitPrice)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{item.gstPercent}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                    {formatINR(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1.5 text-xs border-t border-slate-200 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Inclusive of GST)</span>
                <span className="font-mono tabular-nums">{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Included GST Component</span>
                <span className="font-mono tabular-nums">{formatINR(order.gstTotal)}</span>
              </div>
              {order.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon ({order.couponCode})</span>
                  <span className="font-mono tabular-nums">-{formatINR(order.couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping Charge</span>
                <span className="font-mono tabular-nums">
                  {order.shippingCharge === 0 ? 'FREE' : formatINR(order.shippingCharge)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#0B1F3A] border-t border-slate-300 pt-2">
                <span>Grand Total</span>
                <span className="font-mono tabular-nums">{formatINR(order.grandTotal)}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-4 text-center">
            This is a computer-generated GST Tax Invoice from AAGAMAN MART and requires no physical signature.
          </p>
        </div>
      </div>
    </div>
  );
};
