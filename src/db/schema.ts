import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users (Customers)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default('Customer'),
  phone: text('phone').default(''),
  photoUrl: text('photo_url').default(''),
  role: text('role').notNull().default('customer'),
  passwordHash: text('password_hash'),
  emailVerified: boolean('email_verified').notNull().default(false),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  otpCode: text('otp_code'),
  otpExpiresAt: timestamp('otp_expires_at'),
  resetToken: text('reset_token'),
  resetExpiresAt: timestamp('reset_expires_at'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Admins (Separate admin table)
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('super_admin'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Subcategories
export const subcategories = pgTable('subcategories', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
});

// 5. Products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  brand: text('brand').notNull(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'restrict' })
    .notNull(),
  subcategoryId: integer('subcategory_id').references(() => subcategories.id, {
    onDelete: 'set null',
  }),
  mrp: integer('mrp').notNull(),
  sellingPrice: integer('selling_price').notNull(),
  discountPercent: integer('discount_percent').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  gstPercent: integer('gst_percent').notNull().default(18),
  specifications: jsonb('specifications').$type<Record<string, string>>().notNull().default({}),
  returnPolicy: text('return_policy').notNull().default('7 Days Easy Return & Replacement'),
  ratingAvg: text('rating_avg').notNull().default('4.5'),
  ratingCount: integer('rating_count').notNull().default(0),
  soldCount: integer('sold_count').notNull().default(0),
  isFeatured: boolean('is_featured').notNull().default(false),
  isTrending: boolean('is_trending').notNull().default(false),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  isNewArrival: boolean('is_new_arrival').notNull().default(false),
  isDealOfDay: boolean('is_deal_of_day').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Product Images
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  imageUrl: text('image_url').notNull(),
  altText: text('alt_text').notNull().default(''),
  displayOrder: integer('display_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
});

// 7. Product Variants
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull(),
  size: text('size').notNull().default('Standard'),
  color: text('color').notNull().default('Default'),
  colorHex: text('color_hex').notNull().default('#0B1F3A'),
  priceAdjustment: integer('price_adjustment').notNull().default(0),
  stock: integer('stock').notNull().default(10),
});

// 8. Carts
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Cart Items
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id')
    .references(() => carts.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, {
    onDelete: 'set null',
  }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Wishlists
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Addresses
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2').notNull().default(''),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  landmark: text('landmark').notNull().default(''),
  addressType: text('address_type').notNull().default('Home'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Coupons
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  discountType: text('discount_type').notNull().default('percentage'), // 'percentage' | 'fixed' | 'free_shipping'
  discountValue: integer('discount_value').notNull().default(0),
  minOrderValue: integer('min_order_value').notNull().default(0),
  maxDiscountLimit: integer('max_discount_limit').notNull().default(0),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  firstOrderOnly: boolean('first_order_only').notNull().default(false),
  usageLimit: integer('usage_limit').notNull().default(1000),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Orders
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  addressSnapshot: jsonb('address_snapshot')
    .$type<{
      fullName: string;
      phone: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
      landmark?: string;
      addressType?: string;
    }>()
    .notNull(),
  status: text('status').notNull().default('Order Placed'),
  paymentStatus: text('payment_status').notNull().default('pending'),
  paymentMethod: text('payment_method').notNull(), // 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod'
  subtotal: integer('subtotal').notNull(),
  discountTotal: integer('discount_total').notNull().default(0),
  couponCode: text('coupon_code'),
  couponDiscount: integer('coupon_discount').notNull().default(0),
  gstTotal: integer('gst_total').notNull().default(0),
  shippingCharge: integer('shipping_charge').notNull().default(0),
  grandTotal: integer('grand_total').notNull(),
  shippingMethod: text('shipping_method').notNull().default('Standard Delivery'),
  idempotencyKey: text('idempotency_key').unique(),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Order Items
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'restrict' })
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, {
    onDelete: 'set null',
  }),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  imageUrl: text('image_url').notNull(),
  variantLabel: text('variant_label').notNull().default('Standard'),
  quantity: integer('quantity').notNull(),
  mrp: integer('mrp').notNull(),
  unitPrice: integer('unit_price').notNull(),
  gstPercent: integer('gst_percent').notNull().default(18),
  totalPrice: integer('total_price').notNull(),
});

// 15. Payments
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  gateway: text('gateway').notNull().default('razorpay'), // 'razorpay' | 'cod'
  method: text('method').notNull().default('upi'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpaySignature: text('razorpay_signature'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('pending'), // 'pending' | 'captured' | 'failed' | 'refunded' | 'cod_pending' | 'cod_collected'
  metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 16. Shipping
export const shipping = pgTable('shipping', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  courierPartner: text('courier_partner').notNull().default('Delhivery Express'),
  trackingNumber: text('tracking_number').notNull(),
  status: text('status').notNull().default('Preparing Shipment'),
  estimatedDelivery: text('estimated_delivery').notNull(),
  pincode: text('pincode').notNull(),
  dispatchedAt: timestamp('dispatched_at'),
  deliveredAt: timestamp('delivered_at'),
  trackingHistory: jsonb('tracking_history')
    .$type<Array<{ status: string; location: string; timestamp: string; note: string }>>()
    .notNull()
    .default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 17. Reviews
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  title: text('title').notNull(),
  comment: text('comment').notNull(),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Returns
export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reason: text('reason').notNull(),
  requestType: text('request_type').notNull().default('return'), // 'return' | 'replacement'
  status: text('status').notNull().default('Return Requested'),
  adminNotes: text('admin_notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 19. Refunds
export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  returnId: integer('return_id').references(() => returns.id, { onDelete: 'set null' }),
  paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('Refund Initiated'),
  transactionRef: text('transaction_ref').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  channel: text('channel').notNull().default('in_app'), // 'email' | 'sms' | 'whatsapp' | 'in_app'
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Site Settings & Support Tickets
export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('Open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
  products: many(products),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [products.subcategoryId],
    references: [subcategories.id],
  }),
  images: many(productImages),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  shipping: one(shipping),
  returns: many(returns),
  refunds: many(refunds),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
