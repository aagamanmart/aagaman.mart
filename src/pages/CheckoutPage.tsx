import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
} from 'lucide-react';
import { InvoiceModal } from '../components/InvoiceModal';
import { formatINR, useStore } from '../context/StoreContext';
import type { Address, OrderRecord } from '../types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export const CheckoutPage: React.FC = () => {
  const {
    user,
    authToken,
    cart,
    appliedCouponCode,
    setAppliedCouponCode,
    clearLocalCartAfterOrder,
    setIsAuthModalOpen,
    navigate,
    notify,
    paymentMode,
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new'>('new');

  // Step 1: Customer Details
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');

  // Step 2: Address Form
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrType, setAddrType] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [saveNewAddress, setSaveNewAddress] = useState(true);

  // Step 3: Shipping
  const [shippingMethod, setShippingMethod] = useState<'Standard Delivery' | 'Express Delivery'>(
    'Standard Delivery'
  );

  // Step 4: Payment
  const [paymentMethod, setPaymentMethod] = useState<
    'upi' | 'gpay' | 'phonepe' | 'paytm' | 'card' | 'netbanking' | 'wallet' | 'cod'
  >('upi');
  const [couponInput, setCouponInput] = useState(appliedCouponCode || '');
  const [summary, setSummary] = useState<{
    mrpTotal: number;
    subtotal: number;
    discountTotal: number;
    couponCode: string | null;
    couponDiscount: number;
    gstTotal: number;
    shippingCharge: number;
    grandTotal: number;
  } | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Sandbox Razorpay Modal State (active when RAZORPAY_KEY_SECRET is not set)
  const [sandboxRzpSession, setSandboxRzpSession] = useState<{
    orderNumber: string;
    razorpayOrderId: string;
    amountPaise: number;
    method: string;
  } | null>(null);
  const [sandboxUpiId, setSandboxUpiId] = useState('customer@okaxis');

  // Confirmed Order
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);
  const [idempotencyKey] = useState(() => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.name);
      setCustomerEmail((prev) => prev || user.email);
      setCustomerPhone((prev) => prev || user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (!authToken) return;
    (async () => {
      const res = await fetch('/api/account/addresses', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const list: Address[] = json.addresses || [];
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) setSelectedAddressId(def.id);
      }
    })();
  }, [authToken]);

  // Server-authoritative summary calculation
  const recalculate = async (codeOverride?: string) => {
    if (!authToken || cart.length === 0) return;
    setSummaryError('');
    const res = await fetch('/api/checkout/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        items: cart.map((c) => ({ productId: c.productId, variantId: c.variantId, quantity: c.quantity })),
        couponCode: codeOverride !== undefined ? codeOverride : appliedCouponCode,
        shippingMethod,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSummaryError(json.error || 'Unable to apply coupon.');
    } else {
      setSummary(json.summary);
      if (json.summary.couponCode) setAppliedCouponCode(json.summary.couponCode);
    }
  };

  useEffect(() => {
    recalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, cart, shippingMethod]);

  const activeAddressPayload = useMemo(() => {
    if (selectedAddressId !== 'new') {
      const found = savedAddresses.find((a) => a.id === selectedAddressId);
      if (found) {
        return {
          fullName: found.fullName,
          phone: found.phone,
          line1: found.line1,
          line2: found.line2,
          city: found.city,
          state: found.state,
          pincode: found.pincode,
          landmark: found.landmark,
          addressType: found.addressType,
        };
      }
    }
    return {
      fullName: customerName,
      phone: customerPhone,
      line1: addrLine1,
      line2: addrLine2,
      city: addrCity,
      state: addrState,
      pincode: addrPincode,
      landmark: addrLandmark,
      addressType: addrType,
    };
  }, [
    selectedAddressId,
    savedAddresses,
    customerName,
    customerPhone,
    addrLine1,
    addrLine2,
    addrCity,
    addrState,
    addrPincode,
    addrLandmark,
    addrType,
  ]);

  const loadOrderConfirmation = async (orderNumber: string) => {
    clearLocalCartAfterOrder();
    const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const json = await res.json();
      setConfirmedOrder(json.order);
    }
  };

  const verifyRazorpayPaymentOnBackend = async (payload: {
    orderNumber: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => {
    const res = await fetch('/api/payments/razorpay/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      notify(json.error || 'Payment verification failed.', 'error');
      return;
    }
    notify('Payment verified! Order confirmed.', 'success');
    await loadOrderConfirmation(payload.orderNumber);
  };

  const handlePlaceOrder = async () => {
    if (!authToken) {
      setIsAuthModalOpen(true);
      return;
    }
    setPlacingOrder(true);
    try {
      if (selectedAddressId === 'new' && saveNewAddress) {
        await fetch('/api/account/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(activeAddressPayload),
        });
      }

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          items: cart.map((c) => ({ productId: c.productId, variantId: c.variantId, quantity: c.quantity })),
          customerName,
          customerEmail,
          customerPhone,
          address: activeAddressPayload,
          shippingMethod,
          paymentMethod,
          couponCode: appliedCouponCode || undefined,
          idempotencyKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not place order.', 'error');
        return;
      }

      if (!json.requiresRazorpay) {
        notify('COD Order Placed Successfully!', 'success');
        await loadOrderConfirmation(json.order.orderNumber);
        return;
      }

      // Online Razorpay Flow
      if (json.razorpay.mode === 'live' && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: json.razorpay.keyId,
          amount: json.razorpay.amountPaise,
          currency: 'INR',
          name: 'AAGAMAN MART',
          description: `Order ${json.order.orderNumber}`,
          order_id: json.razorpay.razorpayOrderId,
          prefill: { name: customerName, email: customerEmail, contact: customerPhone },
          theme: { color: '#EA580C' },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            await verifyRazorpayPaymentOnBackend({
              orderNumber: json.order.orderNumber,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: async () => {
              await fetch('/api/payments/razorpay/fail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ orderNumber: json.order.orderNumber, reason: 'User dismissed modal' }),
              });
              notify('Payment cancelled. Your cart items were preserved.', 'info');
            },
          },
        });
        rzp.open();
      } else {
        // Open Sandbox Gateway Simulator that obtains a real server-signed HMAC payment response and runs full backend verification
        setSandboxRzpSession({
          orderNumber: json.order.orderNumber,
          razorpayOrderId: json.razorpay.razorpayOrderId,
          amountPaise: json.razorpay.amountPaise,
          method: paymentMethod,
        });
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  if (confirmedOrder) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold text-[#EA580C] uppercase tracking-wider">
            Order Confirmed · {confirmedOrder.orderNumber}
          </p>
          <h1 className="font-display text-3xl font-bold text-[#0B1F3A]">
            Thank you, {confirmedOrder.customerName}!
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Status: <strong>{confirmedOrder.status}</strong> · Payment:{' '}
            <strong>{confirmedOrder.paymentMethod.toUpperCase()} ({confirmedOrder.paymentStatus.toUpperCase()})</strong>.
            Estimated delivery by <strong>{confirmedOrder.shipping?.estimatedDelivery}</strong>.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left text-sm space-y-2 max-w-lg mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-600">Tracking Number</span>
              <span className="font-mono font-semibold text-[#0B1F3A]">
                {confirmedOrder.shipping?.trackingNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Courier Partner</span>
              <span className="font-medium">{confirmedOrder.shipping?.courierPartner}</span>
            </div>
            <div className="flex justify-between font-bold text-[#0B1F3A] pt-2 border-t border-slate-200">
              <span>Total Amount</span>
              <span className="font-mono tabular-nums">{formatINR(confirmedOrder.grandTotal)}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setInvoiceOrder(confirmedOrder)}
              className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold"
            >
              Download GST Tax Invoice
            </button>
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="px-5 py-2.5 rounded-lg bg-[#EA580C] text-white text-sm font-semibold"
            >
              Track Order in My Account
            </button>
          </div>
        </div>
        <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
      </main>
    );
  }

  if (!authToken) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4">
          <Lock className="w-10 h-10 text-[#EA580C] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Sign In to Complete Checkout</h1>
          <p className="text-sm text-slate-600">
            Your {cart.length} cart item(s) are preserved. Sign in with Google or email to save your delivery address and pay securely.
          </p>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="px-6 py-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm"
          >
            Sign In / Create Account
          </button>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Your Checkout Cart is Empty</h1>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-2.5 rounded-lg bg-[#EA580C] text-white text-sm font-semibold"
        >
          Shop Products
        </button>
      </main>
    );
  }

  const steps = [
    { num: 1, label: 'Customer Details' },
    { num: 2, label: 'Delivery Address' },
    { num: 3, label: 'Shipping Method' },
    { num: 4, label: 'Payment Method' },
    { num: 5, label: 'Review & Pay' },
  ] as const;

  return (
    <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#0B1F3A]">Secure Checkout</h1>
          <p className="text-xs text-slate-500 mt-1">
            Payment Gateway Mode:{' '}
            <strong className="text-[#0B1F3A]">
              {paymentMode === 'live' ? 'Razorpay Live' : 'Razorpay Sandbox Test Mode'}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {steps.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => s.num <= step && setStep(s.num)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                step === s.num
                  ? 'bg-[#EA580C] text-white'
                  : step > s.num
                  ? 'bg-[#0B1F3A] text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {s.num}. {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Multi-step Forms */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Step 1: Customer Details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email for Invoice</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number (+91)</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit Indian mobile number"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!customerName.trim() || !customerEmail.trim() || customerPhone.trim().length < 10) {
                    notify('Please enter name, email, and a valid 10-digit mobile number.', 'error');
                    return;
                  }
                  setStep(2);
                }}
                className="px-6 h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm"
              >
                Continue to Delivery Address
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#EA580C]" /> Step 2: Delivery Address
              </h2>

              {savedAddresses.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {savedAddresses.map((a) => (
                    <label
                      key={a.id}
                      className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                        selectedAddressId === a.id
                          ? 'border-[#EA580C] bg-orange-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          checked={selectedAddressId === a.id}
                          onChange={() => setSelectedAddressId(a.id)}
                          className="mt-1 accent-[#EA580C]"
                        />
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-[#0B1F3A]">
                            {a.fullName} · {a.addressType}
                          </p>
                          <p className="text-slate-600">
                            {a.line1}, {a.city}, {a.state} - {a.pincode}
                          </p>
                          <p className="text-slate-500 font-mono">{a.phone}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`p-4 rounded-xl border cursor-pointer flex items-center gap-2 text-sm font-semibold ${
                      selectedAddressId === 'new' ? 'border-[#EA580C] bg-orange-50/50' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={selectedAddressId === 'new'}
                      onChange={() => setSelectedAddressId('new')}
                      className="accent-[#EA580C]"
                    />
                    <span>+ Add New Delivery Address</span>
                  </label>
                </div>
              )}

              {selectedAddressId === 'new' && (
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <input
                    type="text"
                    value={addrLine1}
                    onChange={(e) => setAddrLine1(e.target.value)}
                    placeholder="House / Flat / Building / Street *"
                    className="sm:col-span-2 h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                  <input
                    type="text"
                    value={addrLine2}
                    onChange={(e) => setAddrLine2(e.target.value)}
                    placeholder="Area / Locality (Optional)"
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                  <input
                    type="text"
                    value={addrLandmark}
                    onChange={(e) => setAddrLandmark(e.target.value)}
                    placeholder="Landmark (Optional)"
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                  <input
                    type="text"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    placeholder="City *"
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                  <input
                    type="text"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    placeholder="State *"
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                  <input
                    type="text"
                    maxLength={6}
                    value={addrPincode}
                    onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-Digit Pincode *"
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                  <select
                    value={addrType}
                    onChange={(e) => setAddrType(e.target.value as 'Home' | 'Work' | 'Other')}
                    className="h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                  <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(e) => setSaveNewAddress(e.target.checked)}
                      className="accent-[#EA580C]"
                    />
                    Save this address to my account
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 h-11 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !activeAddressPayload.line1 ||
                      !activeAddressPayload.city ||
                      !activeAddressPayload.state ||
                      !/^[1-9][0-9]{5}$/.test(activeAddressPayload.pincode)
                    ) {
                      notify('Please enter a complete address and valid 6-digit Indian pincode.', 'error');
                      return;
                    }
                    setStep(3);
                  }}
                  className="px-6 h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm"
                >
                  Continue to Shipping
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A] flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#EA580C]" /> Step 3: Shipping Method
              </h2>
              <div className="space-y-3">
                {[
                  {
                    id: 'Standard Delivery' as const,
                    title: 'Standard Tracked Delivery (Delhivery Express)',
                    eta: '2–4 Business Days',
                    fee: summary && summary.subtotal >= 999 ? 'FREE' : '₹49',
                  },
                  {
                    id: 'Express Delivery' as const,
                    title: 'Express Air Priority (BlueDart Air)',
                    eta: 'Next Business Day across Metro Hubs',
                    fee: '₹129',
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${
                      shippingMethod === opt.id ? 'border-[#EA580C] bg-orange-50/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={shippingMethod === opt.id}
                        onChange={() => setShippingMethod(opt.id)}
                        className="accent-[#EA580C]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#0B1F3A]">{opt.title}</p>
                        <p className="text-xs text-slate-500">{opt.eta}</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-[#0B1F3A]">{opt.fee}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 h-11 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-6 h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#EA580C]" /> Step 4: Choose Indian Payment Method
              </h2>
              <p className="text-xs text-slate-500">
                All online payments are routed via Razorpay with server-side HMAC signature verification. Card numbers and UPI PINs are never stored on our servers.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { id: 'upi', label: 'UPI (Any App / QR)', icon: Smartphone },
                  { id: 'gpay', label: 'Google Pay', icon: Smartphone },
                  { id: 'phonepe', label: 'PhonePe', icon: Smartphone },
                  { id: 'paytm', label: 'Paytm UPI / Wallet', icon: Wallet },
                  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
                  { id: 'netbanking', label: 'Net Banking (All Banks)', icon: ShieldCheck },
                  { id: 'wallet', label: 'Wallets (Amazon Pay / Mobikwik)', icon: Wallet },
                  { id: 'cod', label: 'Cash on Delivery (COD)', icon: Truck },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <label
                      key={m.id}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 ${
                        paymentMethod === m.id ? 'border-[#EA580C] bg-orange-50/50' : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id as typeof paymentMethod)}
                        className="accent-[#EA580C]"
                      />
                      <Icon className="w-4 h-4 text-[#0B1F3A]" />
                      <span className="text-sm font-medium text-[#0B1F3A]">{m.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 h-11 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="px-6 h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm"
                >
                  Review Order Summary
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                Step 5: Review & Confirm Order
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-500 uppercase mb-1">Deliver To</p>
                  <p className="font-bold text-[#0B1F3A]">{activeAddressPayload.fullName}</p>
                  <p className="text-slate-600">
                    {activeAddressPayload.line1}, {activeAddressPayload.city}, {activeAddressPayload.state} -{' '}
                    {activeAddressPayload.pincode}
                  </p>
                  <p className="text-slate-600 font-mono mt-0.5">{activeAddressPayload.phone}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500 uppercase mb-1">Shipping & Payment</p>
                  <p className="text-slate-700">Method: {shippingMethod}</p>
                  <p className="text-slate-700">Payment: {paymentMethod.toUpperCase()}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border-y border-slate-200">
                {cart.map((c) => (
                  <div key={`${c.productId}-${c.variantId}`} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#0B1F3A]">{c.name}</p>
                        <p className="text-xs text-slate-500">
                          {c.variantLabel} · Qty {c.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-[#0B1F3A] tabular-nums">
                      {formatINR(c.unitPrice * c.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-5 h-11 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={handlePlaceOrder}
                  className="flex-1 h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm disabled:opacity-60"
                >
                  {placingOrder
                    ? 'Processing...'
                    : paymentMethod === 'cod'
                    ? `Place COD Order (${formatINR(summary?.grandTotal || 0)})`
                    : `Pay Securely ${formatINR(summary?.grandTotal || 0)}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Order Summary */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 sticky top-32">
          <h3 className="font-display text-lg font-bold text-[#0B1F3A]">Order Summary</h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono uppercase"
            />
            <button
              type="button"
              onClick={() => recalculate(couponInput)}
              className="px-3.5 h-9 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
            >
              Apply
            </button>
          </div>
          {summaryError && <p className="text-xs text-red-600">{summaryError}</p>}

          {summary && (
            <div className="space-y-2 text-sm border-t border-slate-200 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Product Total (MRP)</span>
                <span className="font-mono tabular-nums">{formatINR(summary.mrpTotal)}</span>
              </div>
              {summary.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs font-medium">
                  <span>Marketplace Savings</span>
                  <span className="font-mono tabular-nums">-{formatINR(summary.discountTotal)}</span>
                </div>
              )}
              {summary.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs font-medium">
                  <span>Coupon ({summary.couponCode})</span>
                  <span className="font-mono tabular-nums">-{formatINR(summary.couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Included GST</span>
                <span className="font-mono tabular-nums">{formatINR(summary.gstTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-xs">
                <span>Shipping ({shippingMethod})</span>
                <span className="font-mono tabular-nums">
                  {summary.shippingCharge === 0 ? 'FREE' : formatINR(summary.shippingCharge)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#0B1F3A] pt-2 border-t border-slate-200">
                <span>Final Payable</span>
                <span className="font-mono tabular-nums">{formatINR(summary.grandTotal)}</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Sandbox Razorpay Payment Modal (when live keys aren't configured yet) */}
      {sandboxRzpSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#FDBA74] font-semibold">
                  Razorpay Sandbox Test Checkout
                </p>
                <h3 className="font-display text-lg font-bold">AAGAMAN MART</h3>
              </div>
              <span className="font-mono text-lg font-bold tabular-nums">
                {formatINR(sandboxRzpSession.amountPaise / 100)}
              </span>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <p className="text-xs text-slate-600">
                Order <strong className="font-mono">{sandboxRzpSession.orderNumber}</strong> · Method:{' '}
                <strong>{sandboxRzpSession.method.toUpperCase()}</strong>. This sandbox executes full backend HMAC-SHA256 signature verification and atomic stock deduction.
              </p>

              {['upi', 'gpay', 'phonepe', 'paytm'].includes(sandboxRzpSession.method) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Test UPI ID</label>
                  <input
                    type="text"
                    value={sandboxUpiId}
                    onChange={(e) => setSandboxUpiId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/payments/razorpay/fail', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                      },
                      body: JSON.stringify({
                        orderNumber: sandboxRzpSession.orderNumber,
                        reason: 'Simulated payment failure/cancel',
                      }),
                    });
                    setSandboxRzpSession(null);
                    notify('Payment cancelled. Stock was not deducted.', 'info');
                  }}
                  className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs"
                >
                  Simulate Failure
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const signRes = await fetch('/api/payments/razorpay/sandbox-sign', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                      },
                      body: JSON.stringify({ razorpayOrderId: sandboxRzpSession.razorpayOrderId }),
                    });
                    const signJson = await signRes.json();
                    if (!signRes.ok) {
                      notify(signJson.error || 'Sandbox error', 'error');
                      return;
                    }
                    const ordNum = sandboxRzpSession.orderNumber;
                    setSandboxRzpSession(null);
                    await verifyRazorpayPaymentOnBackend({
                      orderNumber: ordNum,
                      razorpayOrderId: signJson.razorpayOrderId,
                      razorpayPaymentId: signJson.razorpayPaymentId,
                      razorpaySignature: signJson.razorpaySignature,
                    });
                  }}
                  className="flex-1 h-10 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-xs"
                >
                  Authorize & Verify Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
