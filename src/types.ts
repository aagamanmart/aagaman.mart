export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  productCount: number;
  subcategories?: Subcategory[];
}

export interface ProductImage {
  id: number;
  productId: number;
  imageUrl: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  priceAdjustment: number;
  stock: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  categoryId: number;
  subcategoryId: number | null;
  category?: Category | null;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  stock: number;
  lowStockThreshold: number;
  gstPercent: number;
  specifications: Record<string, string>;
  returnPolicy: string;
  ratingAvg: string;
  ratingCount: number;
  soldCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isDealOfDay: boolean;
  isActive: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface Review {
  id: number;
  productId: number;
  userId: number;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  slug: string;
  name: string;
  brand: string;
  sku: string;
  imageUrl: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  gstPercent: number;
  categoryId: number;
  availableStock: number;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isBlocked: boolean;
}

export interface Address {
  id: number;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  addressType: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: number;
  productId: number;
  variantId: number | null;
  productName: string;
  sku: string;
  imageUrl: string;
  variantLabel: string;
  quantity: number;
  mrp: number;
  unitPrice: number;
  gstPercent: number;
  totalPrice: number;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressSnapshot: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    addressType?: string;
  };
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  couponCode: string | null;
  couponDiscount: number;
  gstTotal: number;
  shippingCharge: number;
  grandTotal: number;
  shippingMethod: string;
  createdAt: string;
  items: OrderItem[];
  shipping: {
    courierPartner: string;
    trackingNumber: string;
    status: string;
    estimatedDelivery: string;
    pincode: string;
    trackingHistory: Array<{ status: string; location: string; timestamp: string; note: string }>;
  } | null;
  payment: {
    id: number;
    gateway: string;
    method: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    amount: number;
    status: string;
  } | null;
  returns?: Array<{ id: number; reason: string; requestType: string; status: string; createdAt: string }>;
  refunds?: Array<{ id: number; amount: number; status: string; transactionRef: string; createdAt: string }>;
}

export interface BannerItem {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  categorySlug: string;
  imageUrl: string;
}

export interface StoreConfig {
  siteName: string;
  tagline: string;
  announcementText: string;
  supportEmail: string;
  supportPhone: string;
  headquarters: string;
  freeShippingThreshold: number;
  standardShippingCharge: number;
  expressShippingCharge: number;
  defaultGstPercent: number;
  flashSaleTitle: string;
  flashSaleSubtitle: string;
  flashSaleEndsAt: string;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  banners: BannerItem[];
}

export interface PublicCoupon {
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderValue: number;
}
