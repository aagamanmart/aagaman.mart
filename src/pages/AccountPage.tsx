import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  FileText,
  Heart,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  Shield,
  ShoppingCart,
  Trash2,
  User,
} from 'lucide-react';
import { InvoiceModal } from '../components/InvoiceModal';
import { formatINR, useStore } from '../context/StoreContext';
import type { Address, OrderRecord } from '../types';

interface NotificationItem {
  id: number;
  channel: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const AccountPage: React.FC = () => {
  const {
    user,
    authToken,
    route,
    setIsAuthModalOpen,
    logoutCustomer,
    refreshUser,
    wishlistProducts,
    moveWishlistToCart,
    toggleWishlist,
    navigate,
    notify,
  } = useStore();

  const initialTab = new URLSearchParams(route.split('?')[1] || '').get('tab') || 'orders';
  const [tab, setTab] = useState<'orders' | 'profile' | 'addresses' | 'wishlist' | 'notifications'>(
    (initialTab as 'orders' | 'profile' | 'addresses' | 'wishlist' | 'notifications') || 'orders'
  );

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);
  const [returnModalOrder, setReturnModalOrder] = useState<OrderRecord | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<'return' | 'replacement'>('return');

  // Profile & OTP states
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profPhoto, setProfPhoto] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [sandboxOtpHint, setSandboxOtpHint] = useState('');
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // New Address state
  const [newAddr, setNewAddr] = useState({
    fullName: '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
    addressType: 'Home' as 'Home' | 'Work' | 'Other',
    isDefault: true,
  });

  const loadAccountData = async () => {
    if (!authToken) return;
    const [meRes, ordRes] = await Promise.all([
      fetch('/api/account/me', { headers: { Authorization: `Bearer ${authToken}` } }),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${authToken}` } }),
    ]);
    if (meRes.ok) {
      const meJson = await meRes.json();
      setAddresses(meJson.addresses || []);
      setNotifications(meJson.notifications || []);
      setProfName(meJson.user?.name || '');
      setProfPhone(meJson.user?.phone || '');
      setProfPhoto(meJson.user?.photoUrl || '');
    }
    if (ordRes.ok) {
      const ordJson = await ordRes.json();
      setOrders(ordJson.orders || []);
    }
  };

  useEffect(() => {
    loadAccountData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  if (!user || !authToken) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4">
          <User className="w-10 h-10 text-[#EA580C] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Customer Account</h1>
          <p className="text-sm text-slate-600">
            Sign in to view your order tracking timeline, GST invoices, saved addresses, and wishlist.
          </p>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="px-6 py-3 rounded-lg bg-[#EA580C] text-white font-semibold text-sm"
          >
            Sign In / Register
          </button>
        </div>
      </main>
    );
  }

  const lifecycleSteps = [
    'Order Placed',
    'Payment Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/account/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ name: profName, phone: profPhone, photoUrl: profPhoto }),
    });
    if (res.ok) {
      await refreshUser();
      notify('Profile updated.', 'success');
    }
  };

  const handleSendOtp = async () => {
    const res = await fetch('/api/account/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ phone: profPhone }),
    });
    const json = await res.json();
    if (!res.ok) notify(json.error || 'Could not send OTP', 'error');
    else {
      if (json.sandboxOtp) setSandboxOtpHint(json.sandboxOtp);
      notify('6-digit OTP sent.', 'success');
    }
  };

  const handleVerifyOtp = async () => {
    const res = await fetch('/api/account/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ otp: otpInput }),
    });
    const json = await res.json();
    if (!res.ok) notify(json.error || 'OTP invalid', 'error');
    else {
      setSandboxOtpHint('');
      setOtpInput('');
      await refreshUser();
      notify('Mobile number verified!', 'success');
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 space-y-6">
      <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border-2 border-[#EA580C]"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#EA580C] flex items-center justify-center font-display text-xl font-bold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold">{user.name}</h1>
            <p className="text-xs text-slate-300">
              {user.email} · {user.emailVerified ? 'Email Verified' : 'Email Unverified'} ·{' '}
              {user.phoneVerified ? 'Mobile Verified' : 'Mobile Unverified'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logoutCustomer}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-2 self-start sm:self-center"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 pb-3">
        {[
          { id: 'orders', label: `My Orders (${orders.length})`, icon: Package },
          { id: 'wishlist', label: `Wishlist (${wishlistProducts.length})`, icon: Heart },
          { id: 'addresses', label: `Addresses (${addresses.length})`, icon: MapPin },
          { id: 'profile', label: 'Profile & Security', icon: Shield },
          { id: 'notifications', label: `Notifications (${notifications.length})`, icon: Bell },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                tab === t.id ? 'bg-[#0B1F3A] text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4 text-[#EA580C]" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <section className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <p className="font-display text-lg font-bold text-[#0B1F3A]">No orders placed yet</p>
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="px-5 py-2.5 rounded-lg bg-[#EA580C] text-white text-sm font-semibold"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            orders.map((order) => {
              const stepIdx = lifecycleSteps.indexOf(order.status);
              const canCancel = ['Order Placed', 'Payment Pending', 'Payment Confirmed', 'Processing', 'Packed'].includes(
                order.status
              );
              return (
                <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="space-y-0.5">
                      <p className="font-mono text-sm font-bold text-[#0B1F3A]">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">
                        Placed {new Date(order.createdAt).toLocaleString('en-IN')} · {order.paymentMethod.toUpperCase()} (
                        {order.paymentStatus.toUpperCase()})
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold px-3 py-1 rounded bg-slate-100 text-[#0B1F3A]">
                        {order.status}
                      </span>
                      <span className="font-mono text-base font-bold text-[#EA580C] tabular-nums">
                        {formatINR(order.grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Tracking Stepper */}
                  {stepIdx >= 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-[11px]">
                      {lifecycleSteps.map((s, idx) => (
                        <div
                          key={s}
                          className={`p-2 rounded-lg border text-center font-medium ${
                            idx <= stepIdx
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Items */}
                  <div className="divide-y divide-slate-100">
                    {order.items.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                          />
                          <div>
                            <p className="font-semibold text-[#0B1F3A]">{item.productName}</p>
                            <p className="text-xs text-slate-500">
                              {item.variantLabel} · Qty {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold tabular-nums">
                          {formatINR(item.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Shipping & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="text-slate-600">
                      Courier: <strong>{order.shipping?.courierPartner}</strong> · Tracking:{' '}
                      <span className="font-mono">{order.shipping?.trackingNumber}</span> · ETA:{' '}
                      <strong>{order.shipping?.estimatedDelivery}</strong>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoiceOrder(order)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 font-semibold flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" /> GST Invoice
                      </button>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/orders/${order.orderNumber}/cancel`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${authToken}` },
                            });
                            if (res.ok) {
                              notify('Order cancelled.', 'info');
                              loadAccountData();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                        >
                          Cancel Order
                        </button>
                      )}
                      {order.status === 'Delivered' && (
                        <button
                          type="button"
                          onClick={() => setReturnModalOrder(order)}
                          className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white font-semibold flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Return / Replace
                        </button>
                      )}
                    </div>
                  </div>

                  {order.refunds && order.refunds.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
                      Refund Status: <strong>{order.refunds[0].status}</strong> ·{' '}
                      {formatINR(order.refunds[0].amount)} (Ref: {order.refunds[0].transactionRef})
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Wishlist Tab */}
      {tab === 'wishlist' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {wishlistProducts.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-8 text-center">
              Your wishlist is empty.
            </p>
          ) : (
            wishlistProducts.map((p) => {
              const img = p.images?.find((i) => i.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl;
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <img
                    src={img}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover rounded-lg bg-slate-100"
                  />
                  <p className="font-display text-sm font-bold text-[#0B1F3A] line-clamp-2">{p.name}</p>
                  <p className="font-mono font-bold text-[#EA580C] tabular-nums">{formatINR(p.sellingPrice)}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveWishlistToCart(p.id)}
                      className="flex-1 h-9 rounded-lg bg-[#EA580C] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Move to Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(p)}
                      className="px-3 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Addresses Tab */}
      {tab === 'addresses' && (
        <section className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            {addresses.map((a) => (
              <div
                key={a.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div className="text-sm space-y-1">
                  <p className="font-bold text-[#0B1F3A]">
                    {a.fullName} · {a.addressType} {a.isDefault ? '(Default)' : ''}
                  </p>
                  <p className="text-slate-600 text-xs">
                    {a.line1}, {a.city}, {a.state} - {a.pincode}
                  </p>
                  <p className="text-slate-500 font-mono text-xs">{a.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/account/addresses/${a.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${authToken}` },
                    });
                    loadAccountData();
                  }}
                  className="text-slate-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch('/api/account/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify(newAddr),
              });
              const json = await res.json();
              if (!res.ok) notify(json.error || 'Invalid address', 'error');
              else {
                notify('Address added!', 'success');
                setNewAddr({
                  fullName: '',
                  phone: '',
                  line1: '',
                  city: '',
                  state: '',
                  pincode: '',
                  addressType: 'Home',
                  isDefault: true,
                });
                loadAccountData();
              }
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="font-display font-bold text-[#0B1F3A]">Add Delivery Address</h3>
            <input
              required
              placeholder="Recipient Full Name"
              value={newAddr.fullName}
              onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
            <input
              required
              placeholder="Mobile Number"
              value={newAddr.phone}
              onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
            <input
              required
              placeholder="Street / House / Flat"
              value={newAddr.line1}
              onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                placeholder="City"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
              />
              <input
                required
                placeholder="State"
                value={newAddr.state}
                onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <input
              required
              maxLength={6}
              placeholder="6-Digit Pincode"
              value={newAddr.pincode}
              onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, '') })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <button type="submit" className="w-full h-10 rounded-lg bg-[#EA580C] text-white text-xs font-semibold">
              Save Address
            </button>
          </form>
        </section>
      )}

      {/* Profile & Security Tab */}
      {tab === 'profile' && (
        <section className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#0B1F3A]">Profile & Verification</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                placeholder="Full Name"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              />
              <input
                type="url"
                value={profPhoto}
                onChange={(e) => setProfPhoto(e.target.value)}
                placeholder="Profile Photo URL (Optional)"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  placeholder="Mobile Number (+91)"
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono"
                />
                {!user.phoneVerified && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="px-3 h-10 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Send OTP
                  </button>
                )}
              </div>
              {sandboxOtpHint && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
                  <p>
                    Sandbox Mobile OTP: <strong className="font-mono">{sandboxOtpHint}</strong>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="flex-1 h-8 px-2.5 rounded border border-amber-300 bg-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="px-3 h-8 rounded bg-[#EA580C] text-white font-semibold"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              {!user.emailVerified ? (
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/account/verify-email', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${authToken}` },
                    });
                    await refreshUser();
                    notify('Email verified.', 'success');
                  }}
                  className="text-xs font-semibold text-[#EA580C] underline"
                >
                  Verify Email Address
                </button>
              ) : (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Email Verified
                </span>
              )}
              <button type="submit" className="px-5 h-10 rounded-lg bg-[#EA580C] text-white text-sm font-semibold">
                Save Profile
              </button>
            </div>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch('/api/account/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ currentPassword: currPass, newPassword: newPass }),
              });
              const json = await res.json();
              if (!res.ok) notify(json.error || 'Error updating password', 'error');
              else {
                setCurrPass('');
                setNewPass('');
                notify('Password updated!', 'success');
              }
            }}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-[#0B1F3A]">Change Password</h3>
            <input
              type="password"
              value={currPass}
              onChange={(e) => setCurrPass(e.target.value)}
              placeholder="Current Password (leave blank if Google-only)"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
            />
            <input
              type="password"
              required
              minLength={6}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="New Password (min 6 characters)"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
            />
            <button type="submit" className="px-5 h-10 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold">
              Update Password
            </button>
          </form>
        </section>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <section className="space-y-3">
          {notifications.length === 0 ? (
            <p className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-sm text-[#0B1F3A]">{n.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(n.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))
          )}
        </section>
      )}

      {/* Return / Replacement Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch(`/api/orders/${returnModalOrder.orderNumber}/return`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ reason: returnReason, requestType: returnType }),
              });
              const json = await res.json();
              if (!res.ok) notify(json.error || 'Unable to submit return', 'error');
              else {
                notify('Return / Replacement request submitted.', 'success');
                setReturnModalOrder(null);
                setReturnReason('');
                loadAccountData();
              }
            }}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
              Request Return · {returnModalOrder.orderNumber}
            </h3>
            <select
              value={returnType}
              onChange={(e) => setReturnType(e.target.value as 'return' | 'replacement')}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="return">Return & Full Refund</option>
              <option value="replacement">Free Product Replacement</option>
            </select>
            <textarea
              required
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Describe the reason for return or replacement..."
              className="w-full p-3 rounded-lg border border-slate-300 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="px-4 h-9 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 h-9 rounded-lg bg-[#EA580C] text-white text-xs font-semibold">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
    </main>
  );
};
