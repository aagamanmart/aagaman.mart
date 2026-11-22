import React from 'react';
import { Mail, MapPin, Phone, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const Footer: React.FC = () => {
  const { config, categories, navigate } = useStore();

  return (
    <footer className="bg-[#0B1F3A] text-slate-300 border-t border-white/10 mt-16">
      {/* Trust Strip */}
      <div className="border-b border-white/10 bg-[#102A43]">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-[#F97316] shrink-0" />
            <div>
              <p className="font-semibold text-white">Pan-India Tracked Delivery</p>
              <p className="text-xs text-slate-300">Free shipping above ₹{config?.freeShippingThreshold || 999}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#F97316] shrink-0" />
            <div>
              <p className="font-semibold text-white">Verified Razorpay & COD</p>
              <p className="text-xs text-slate-300">UPI, Cards, Net Banking & Cash on Delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-6 h-6 text-[#F97316] shrink-0" />
            <div>
              <p className="font-semibold text-white">Dedicated Indian Support</p>
              <p className="text-xs text-slate-300">{config?.supportPhone || '+91 1800-202-4499'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EA580C] text-white font-extrabold text-sm">
              AM
            </span>
            <span className="font-display text-xl font-bold text-white">AAGAMAN MART</span>
          </div>
          <p className="text-sm text-orange-300 font-medium">
            {config?.tagline || 'Quality That Moves You Forward.'}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            India&apos;s trusted marketplace for groceries, electronics, fashion, appliances, and home essentials with verified GST invoicing.
          </p>
          <div className="space-y-1.5 pt-2 text-xs text-slate-400">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
              <span>{config?.headquarters || 'Bandra Kurla Complex, Mumbai 400051'}</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#F97316] shrink-0" />
              <span>{config?.supportEmail || 'support@aagamanmart.in'}</span>
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold text-white mb-4">Top Categories</h3>
          <ul className="space-y-2 text-xs">
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/category/${c.slug}`)}
                  className="hover:text-[#F97316] transition-colors text-left"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold text-white mb-4">Customer Service</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => navigate('/account')} className="hover:text-[#F97316] transition-colors">
                My Orders & Tracking
              </button>
            </li>
            <li>
              <button onClick={() => navigate('/support')} className="hover:text-[#F97316] transition-colors">
                Contact Us & Support Ticket
              </button>
            </li>
            <li>
              <button onClick={() => navigate('/faq')} className="hover:text-[#F97316] transition-colors">
                Frequently Asked Questions
              </button>
            </li>
            <li>
              <button onClick={() => navigate('/policy/returns')} className="hover:text-[#F97316] transition-colors">
                Return & Refund Policy
              </button>
            </li>
            <li>
              <button onClick={() => navigate('/policy/shipping')} className="hover:text-[#F97316] transition-colors">
                Shipping Policy
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold text-white mb-4">Policies & Governance</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => navigate('/policy/privacy')} className="hover:text-[#F97316] transition-colors">
                Privacy Policy
              </button>
            </li>
            <li>
              <button onClick={() => navigate('/policy/terms')} className="hover:text-[#F97316] transition-colors">
                Terms & Conditions
              </button>
            </li>
            <li>
              <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:text-[#F97316] transition-colors">
                XML Sitemap
              </a>
            </li>
            <li>
              <button
                onClick={() => navigate('/admin')}
                className="text-[#FDBA74] hover:text-white font-semibold transition-colors pt-1"
              >
                Admin Store Console →
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 px-4 lg:px-8 text-xs text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} AAGAMAN MART. All rights reserved.</p>
          <p>Accepted in India: UPI · Google Pay · PhonePe · Paytm · RuPay/Visa/Mastercard · COD</p>
        </div>
      </div>
    </footer>
  );
};
