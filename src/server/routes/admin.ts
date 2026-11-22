import crypto from 'node:crypto';
import { Router } from 'express';
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  admins,
  categories,
  coupons,
  notifications,
  orderItems,
  orders,
  payments,
  productImages,
  products,
  productVariants,
  refunds,
  returns,
  shipping,
  siteSettings,
  subcategories,
  supportTickets,
  users,
} from '../../db/schema.ts';
import { createRateLimiter, hashPassword, signToken, verifyPassword } from '../../lib/security.ts';
import { requireAdmin, type AuthRequest } from '../../middleware/auth.ts';

export const adminRouter = Router();
const adminLoginLimiter = createRateLimiter(60_000, 15);

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

adminRouter.get('/admin/status', async (_req, res) => {
  try {
    const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    const existingAdmins = await db.select({ total: count() }).from(admins);
    const hasDbAdmin = (existingAdmins[0]?.total ?? 0) > 0;
    res.json({
      needsBootstrap: !envPasscodeSet && !hasDbAdmin,
      envOverrideActive: envPasscodeSet,
    });
  } catch (error) {
    console.error('Admin status error:', error);
    res.status(500).json({ error: 'Unable to check admin status.' });
  }
});

// One-time atomic admin setup when ADMIN_PASSCODE env is unset and no admin exists yet
adminRouter.post('/admin/bootstrap', adminLoginLimiter, async (req, res) => {
  const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
  if (envPasscodeSet) {
    return res.status(403).json({ error: 'Admin passcode is managed via environment configuration.' });
  }

  const schema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Provide name, valid email, and a password of at least 8 characters.' });
  }

  try {
    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ total: count() }).from(admins);
      if ((existing[0]?.total ?? 0) > 0) {
        return null;
      }
      const [row] = await tx
        .insert(admins)
        .values({
          name: parsed.data.name.trim(),
          email: parsed.data.email.toLowerCase(),
          passwordHash: hashPassword(parsed.data.password),
          role: 'super_admin',
        })
        .returning();
      return row;
    });

    if (!created) {
      return res.status(409).json({ error: 'Admin account has already been claimed.' });
    }

    const token = signToken({ scope: 'admin', adminId: created.id, email: created.email }, 60 * 60 * 12);
    res.status(201).json({
      token,
      admin: { id: created.id, email: created.email, name: created.name, role: created.role },
    });
  } catch (error) {
    console.error('Admin bootstrap error:', error);
    res.status(500).json({ error: 'Failed to configure admin account.' });
  }
});

adminRouter.post('/admin/login', adminLoginLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email().optional().default('admin@aagamanmart.in'),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter admin credentials.' });

  try {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode && envPasscode.length > 0) {
      const providedBuf = Buffer.from(parsed.data.password);
      const expectedBuf = Buffer.from(envPasscode);
      if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        const token = signToken(
          { scope: 'admin', adminId: 0, envOverride: true, email: parsed.data.email, name: 'Store Administrator' },
          60 * 60 * 12
        );
        return res.json({
          token,
          admin: { id: 0, email: parsed.data.email, name: 'Store Administrator', role: 'super_admin' },
        });
      }
      return res.status(401).json({ error: 'Invalid admin passcode.' });
    }

    const found = await db
      .select()
      .from(admins)
      .where(eq(admins.email, parsed.data.email.toLowerCase()))
      .limit(1);

    const admin = found[0];
    if (!admin || !admin.isActive || !verifyPassword(parsed.data.password, admin.passwordHash)) {
      return res.status(401).json({ error: 'Invalid admin email or password.' });
    }

    await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
    const token = signToken({ scope: 'admin', adminId: admin.id, email: admin.email }, 60 * 60 * 12);
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Admin sign in failed.' });
  }
});

// Dashboard KPIs & Analytics
adminRouter.get('/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const [allOrders, allProducts, allUsers, recentOrders] = await Promise.all([
      db.select().from(orders),
      db.select().from(products),
      db.select().from(users),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    ]);

    const totalRevenue = allOrders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Payment Failed')
      .reduce((sum, o) => sum + o.grandTotal, 0);

    const pendingOrders = allOrders.filter((o) =>
      ['Order Placed', 'Payment Pending', 'Payment Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery'].includes(o.status)
    ).length;
    const deliveredOrders = allOrders.filter((o) => o.status === 'Delivered').length;
    const cancelledOrders = allOrders.filter((o) => o.status === 'Cancelled').length;

    const lowStockProducts = allProducts
      .filter((p) => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    const bestSellingProducts = [...allProducts].sort((a, b) => b.soldCount - a.soldCount).slice(0, 6);

    // 7-day daily revenue trend
    const dailyMap = new Map<string, { day: string; revenue: number; orders: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
      dailyMap.set(key, { day: label, revenue: 0, orders: 0 });
    }
    for (const o of allOrders) {
      if (o.status === 'Cancelled' || o.status === 'Payment Failed') continue;
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.revenue += o.grandTotal;
        entry.orders += 1;
      }
    }

    res.json({
      kpis: {
        totalRevenue,
        totalOrders: allOrders.length,
        totalCustomers: allUsers.length,
        totalProducts: allProducts.length,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        totalUnitsSold: allProducts.reduce((s, p) => s + p.soldCount, 0),
      },
      lowStockProducts,
      bestSellingProducts,
      recentOrders,
      salesChart: Array.from(dailyMap.values()),
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

// Admin Products CRUD
adminRouter.get('/admin/products', requireAdmin, async (_req, res) => {
  const [prods, cats, imgs, vars] = await Promise.all([
    db.select().from(products).orderBy(desc(products.createdAt)),
    db.select().from(categories),
    db.select().from(productImages).orderBy(asc(productImages.displayOrder), asc(productImages.id)),
    db.select().from(productVariants),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  res.json({
    products: prods.map((p) => ({
      ...p,
      categoryName: catMap.get(p.categoryId) || '',
      images: imgs.filter((i) => i.productId === p.id),
      variants: vars.filter((v) => v.productId === p.id),
    })),
  });
});

adminRouter.post('/admin/products', requireAdmin, async (req, res) => {
  const schema = z.object({
    sku: z.string().min(2),
    name: z.string().min(2),
    brand: z.string().min(2),
    categoryId: z.number().int().positive(),
    subcategoryId: z.number().int().positive().nullable().optional(),
    description: z.string().min(5),
    mrp: z.number().int().positive(),
    sellingPrice: z.number().int().positive(),
    stock: z.number().int().min(0),
    gstPercent: z.number().int().min(0).max(28).default(18),
    returnPolicy: z.string().default('7 Days Easy Return & Replacement'),
    imageUrls: z.array(z.string().min(1)).min(1),
    specifications: z.record(z.string(), z.string()).optional().default({}),
    variants: z
      .array(
        z.object({
          sku: z.string().min(2),
          size: z.string().min(1),
          color: z.string().min(1),
          colorHex: z.string().default('#0B1F3A'),
          priceAdjustment: z.number().int().default(0),
          stock: z.number().int().min(0),
        })
      )
      .optional()
      .default([]),
    isFeatured: z.boolean().optional().default(false),
    isTrending: z.boolean().optional().default(false),
    isBestSeller: z.boolean().optional().default(false),
    isNewArrival: z.boolean().optional().default(true),
    isDealOfDay: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product.' });
  if (parsed.data.imageUrls.some((url) => !isSafeImageUrl(url))) {
    return res.status(400).json({ error: 'All product image URLs must use https://, http://, or /src/assets/ paths.' });
  }
  if (parsed.data.sellingPrice > parsed.data.mrp) {
    return res.status(400).json({ error: 'Selling price cannot exceed MRP.' });
  }

  try {
    const slugBase = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${crypto.randomBytes(2).toString('hex')}`;
    const discountPercent = Math.max(
      0,
      Math.round(((parsed.data.mrp - parsed.data.sellingPrice) / parsed.data.mrp) * 100)
    );

    const [created] = await db
      .insert(products)
      .values({
        sku: parsed.data.sku.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        slug,
        brand: parsed.data.brand.trim(),
        categoryId: parsed.data.categoryId,
        subcategoryId: parsed.data.subcategoryId ?? null,
        description: parsed.data.description,
        mrp: parsed.data.mrp,
        sellingPrice: parsed.data.sellingPrice,
        discountPercent,
        stock: parsed.data.stock,
        gstPercent: parsed.data.gstPercent,
        returnPolicy: parsed.data.returnPolicy,
        specifications: parsed.data.specifications,
        isFeatured: parsed.data.isFeatured,
        isTrending: parsed.data.isTrending,
        isBestSeller: parsed.data.isBestSeller,
        isNewArrival: parsed.data.isNewArrival,
        isDealOfDay: parsed.data.isDealOfDay,
      })
      .returning();

    for (let i = 0; i < parsed.data.imageUrls.length; i++) {
      await db.insert(productImages).values({
        productId: created.id,
        imageUrl: parsed.data.imageUrls[i],
        altText: created.name,
        displayOrder: i,
        isPrimary: i === 0,
      });
    }

    for (const v of parsed.data.variants) {
      await db.insert(productVariants).values({ ...v, productId: created.id });
    }

    res.status(201).json({ product: created });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product (SKU may already exist).' });
  }
});

adminRouter.put('/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    sku: z.string().trim().min(2).optional(),
    name: z.string().trim().min(2).optional(),
    brand: z.string().trim().min(2).optional(),
    categoryId: z.number().int().positive().optional(),
    mrp: z.number().int().positive().optional(),
    sellingPrice: z.number().int().positive().optional(),
    stock: z.number().int().min(0).optional(),
    gstPercent: z.number().int().min(0).max(28).optional(),
    returnPolicy: z.string().trim().min(2).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    isBestSeller: z.boolean().optional(),
    isNewArrival: z.boolean().optional(),
    isDealOfDay: z.boolean().optional(),
    description: z.string().trim().min(2).optional(),
    imageUrls: z.array(z.string().trim().min(1)).min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) {
    return res.status(400).json({ error: parsed.error?.issues[0]?.message || 'Invalid product update.' });
  }

  if (parsed.data.imageUrls && parsed.data.imageUrls.some((url) => !isSafeImageUrl(url))) {
    return res.status(400).json({ error: 'All product image URLs must use https://, http://, or /src/assets/ paths.' });
  }

  const existing = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found.' });

  const { imageUrls, sku, ...productFields } = parsed.data;
  const nextMrp = productFields.mrp ?? existing[0].mrp;
  const nextPrice = productFields.sellingPrice ?? existing[0].sellingPrice;
  if (nextPrice > nextMrp) {
    return res.status(400).json({ error: 'Selling price cannot exceed MRP.' });
  }
  const discountPercent = Math.max(0, Math.round(((nextMrp - nextPrice) / nextMrp) * 100));

  try {
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({
          ...productFields,
          ...(sku ? { sku: sku.toUpperCase() } : {}),
          discountPercent,
        })
        .where(eq(products.id, id))
        .returning();

      if (imageUrls) {
        await tx.delete(productImages).where(eq(productImages.productId, id));
        for (let i = 0; i < imageUrls.length; i++) {
          await tx.insert(productImages).values({
            productId: id,
            imageUrl: imageUrls[i].trim(),
            altText: updated.name,
            displayOrder: i,
            isPrimary: i === 0,
          });
        }
      }

      const imgs = await tx
        .select()
        .from(productImages)
        .where(eq(productImages.productId, id))
        .orderBy(asc(productImages.displayOrder), asc(productImages.id));

      return { ...updated, images: imgs };
    });

    res.json({ product: result });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product (SKU may already exist).' });
  }
});

adminRouter.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  res.json({ ok: true });
});

// Admin Categories CRUD
adminRouter.get('/admin/categories', requireAdmin, async (_req, res) => {
  const [cats, subs] = await Promise.all([db.select().from(categories), db.select().from(subcategories)]);
  res.json({
    categories: cats.map((c) => ({
      ...c,
      subcategories: subs.filter((s) => s.categoryId === c.id),
    })),
  });
});

adminRouter.post('/admin/categories', requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    description: z.string().optional().default(''),
    imageUrl: z.string().optional().default('/src/assets/images/prod_groceries_organic_1795321794873.jpg'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Category name required.' });

  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [created] = await db
    .insert(categories)
    .values({
      name: parsed.data.name.trim(),
      slug,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
    })
    .returning();
  res.status(201).json({ category: created });
});

adminRouter.put('/admin/categories/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: 'Invalid category.' });
  const [updated] = await db.update(categories).set(parsed.data).where(eq(categories.id, id)).returning();
  res.json({ category: updated });
});

adminRouter.delete('/admin/categories/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(categories).set({ isActive: false }).where(eq(categories.id, id));
  res.json({ ok: true });
});

adminRouter.post('/admin/subcategories', requireAdmin, async (req, res) => {
  const schema = z.object({ categoryId: z.number().int().positive(), name: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid subcategory.' });
  const slug = `${parsed.data.categoryId}-${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const [created] = await db
    .insert(subcategories)
    .values({ categoryId: parsed.data.categoryId, name: parsed.data.name, slug })
    .returning();
  res.status(201).json({ subcategory: created });
});

// Admin Orders, Shipping, Returns & Refunds
adminRouter.get('/admin/orders', requireAdmin, async (_req, res) => {
  const [allOrders, allItems, allShip, allPays, allReturns, allRefunds] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(orderItems),
    db.select().from(shipping),
    db.select().from(payments),
    db.select().from(returns).orderBy(desc(returns.createdAt)),
    db.select().from(refunds).orderBy(desc(refunds.createdAt)),
  ]);

  res.json({
    orders: allOrders.map((o) => ({
      ...o,
      items: allItems.filter((i) => i.orderId === o.id),
      shipping: allShip.find((s) => s.orderId === o.id) || null,
      payment: allPays.find((p) => p.orderId === o.id) || null,
    })),
    returns: allReturns,
    refunds: allRefunds,
  });
});

adminRouter.patch('/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    status: z.enum([
      'Order Placed',
      'Payment Confirmed',
      'Processing',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Return Requested',
      'Returned',
      'Refund Initiated',
      'Refunded',
    ]),
    courierPartner: z.string().optional(),
    trackingNumber: z.string().optional(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: 'Invalid status update.' });

  const orderRows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = orderRows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const [updated] = await db
    .update(orders)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();

  const shipRows = await db.select().from(shipping).where(eq(shipping.orderId, id)).limit(1);
  if (shipRows[0]) {
    const history = Array.isArray(shipRows[0].trackingHistory) ? shipRows[0].trackingHistory : [];
    await db
      .update(shipping)
      .set({
        ...(parsed.data.courierPartner ? { courierPartner: parsed.data.courierPartner } : {}),
        ...(parsed.data.trackingNumber ? { trackingNumber: parsed.data.trackingNumber } : {}),
        status: parsed.data.status,
        ...(parsed.data.status === 'Shipped' ? { dispatchedAt: new Date() } : {}),
        ...(parsed.data.status === 'Delivered' ? { deliveredAt: new Date() } : {}),
        trackingHistory: [
          ...history,
          {
            status: parsed.data.status,
            location: parsed.data.status === 'Delivered' ? order.addressSnapshot.city : 'Aagaman Logistics Network',
            timestamp: new Date().toISOString(),
            note: parsed.data.note || `Order status updated to ${parsed.data.status}.`,
          },
        ],
        updatedAt: new Date(),
      })
      .where(eq(shipping.id, shipRows[0].id));
  }

  await db.insert(notifications).values({
    userId: order.userId,
    channel: 'email',
    type: 'order_status',
    title: `Order ${order.orderNumber}: ${parsed.data.status}`,
    message: parsed.data.note || `Your AAGAMAN MART order ${order.orderNumber} is now ${parsed.data.status}.`,
  });

  res.json({ order: updated });
});

adminRouter.patch('/admin/returns/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    status: z.enum(['Approved', 'Picked Up', 'Returned', 'Rejected']),
    adminNotes: z.string().optional().default(''),
    issueRefund: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: 'Invalid return update.' });

  const retRows = await db.select().from(returns).where(eq(returns.id, id)).limit(1);
  const ret = retRows[0];
  if (!ret) return res.status(404).json({ error: 'Return request not found.' });

  await db
    .update(returns)
    .set({ status: parsed.data.status, adminNotes: parsed.data.adminNotes, updatedAt: new Date() })
    .where(eq(returns.id, id));

  const orderRows = await db.select().from(orders).where(eq(orders.id, ret.orderId)).limit(1);
  if (orderRows[0]) {
    const order = orderRows[0];
    if (parsed.data.issueRefund) {
      const payRows = await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
      await db.insert(refunds).values({
        orderId: order.id,
        returnId: ret.id,
        paymentId: payRows[0]?.id ?? null,
        userId: order.userId,
        amount: order.grandTotal,
        status: 'Refunded',
        transactionRef: `RFD-${crypto.randomInt(100000, 999999)}`,
      });
      await db.update(orders).set({ status: 'Refunded', updatedAt: new Date() }).where(eq(orders.id, order.id));
      await db.insert(notifications).values({
        userId: order.userId,
        channel: 'email',
        type: 'refund_processed',
        title: `Refund Processed · ${order.orderNumber}`,
        message: `Your refund of ₹${order.grandTotal.toLocaleString('en-IN')} has been processed.`,
      });
    } else if (parsed.data.status === 'Returned') {
      await db.update(orders).set({ status: 'Returned', updatedAt: new Date() }).where(eq(orders.id, order.id));
    }
  }

  res.json({ ok: true });
});

// Admin Customers
adminRouter.get('/admin/customers', requireAdmin, async (_req, res) => {
  const [allUsers, orderAgg] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db
      .select({
        userId: orders.userId,
        orderCount: sql<number>`cast(count(*) as int)`,
        totalSpent: sql<number>`cast(coalesce(sum(${orders.grandTotal}), 0) as int)`,
      })
      .from(orders)
      .groupBy(orders.userId),
  ]);
  const aggMap = new Map(orderAgg.map((a) => [a.userId, a]));

  res.json({
    customers: allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt,
      orderCount: aggMap.get(u.id)?.orderCount || 0,
      totalSpent: aggMap.get(u.id)?.totalSpent || 0,
    })),
  });
});

adminRouter.patch('/admin/customers/:id/block', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ isBlocked: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: 'Invalid request.' });
  await db.update(users).set({ isBlocked: parsed.data.isBlocked }).where(eq(users.id, id));
  res.json({ ok: true });
});

// Admin Payments
adminRouter.get('/admin/payments', requireAdmin, async (_req, res) => {
  const [allPayments, allOrders] = await Promise.all([
    db.select().from(payments).orderBy(desc(payments.createdAt)),
    db.select().from(orders),
  ]);
  const orderMap = new Map(allOrders.map((o) => [o.id, o]));
  res.json({
    payments: allPayments.map((p) => ({
      ...p,
      orderNumber: orderMap.get(p.orderId)?.orderNumber || '',
      customerName: orderMap.get(p.orderId)?.customerName || '',
    })),
  });
});

adminRouter.patch('/admin/payments/:id/cod-collected', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const payRows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!payRows[0]) return res.status(404).json({ error: 'Payment not found.' });
  await db
    .update(payments)
    .set({ status: 'cod_collected', updatedAt: new Date() })
    .where(eq(payments.id, id));
  await db
    .update(orders)
    .set({ paymentStatus: 'paid', updatedAt: new Date() })
    .where(eq(orders.id, payRows[0].orderId));
  res.json({ ok: true });
});

// Admin Coupons
adminRouter.get('/admin/coupons', requireAdmin, async (_req, res) => {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  res.json({ coupons: rows });
});

adminRouter.post('/admin/coupons', requireAdmin, async (req, res) => {
  const schema = z.object({
    code: z.string().min(3).max(30),
    description: z.string().min(3),
    discountType: z.enum(['percentage', 'fixed', 'free_shipping']),
    discountValue: z.number().int().min(0),
    minOrderValue: z.number().int().min(0).default(0),
    maxDiscountLimit: z.number().int().min(0).default(0),
    firstOrderOnly: z.boolean().default(false),
    usageLimit: z.number().int().min(1).default(1000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid coupon details.' });

  const [created] = await db
    .insert(coupons)
    .values({
      ...parsed.data,
      code: parsed.data.code.trim().toUpperCase(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      isActive: true,
    })
    .returning();
  res.status(201).json({ coupon: created });
});

adminRouter.patch('/admin/coupons/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ isActive: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: 'Invalid request.' });
  await db.update(coupons).set({ isActive: parsed.data.isActive }).where(eq(coupons.id, id));
  res.json({ ok: true });
});

adminRouter.delete('/admin/coupons/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(coupons).where(eq(coupons.id, id));
  res.json({ ok: true });
});

// Admin Site Settings & Support Tickets
adminRouter.get('/admin/settings', requireAdmin, async (_req, res) => {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, 'store_config')).limit(1);
  res.json({ config: rows[0]?.value || {} });
});

adminRouter.put('/admin/settings', requireAdmin, async (req, res) => {
  const schema = z.object({ config: z.record(z.string(), z.unknown()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid settings object.' });

  await db
    .insert(siteSettings)
    .values({ key: 'store_config', value: parsed.data.config, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: parsed.data.config, updatedAt: new Date() },
    });

  res.json({ ok: true, config: parsed.data.config });
});

adminRouter.get('/admin/support-tickets', requireAdmin, async (_req, res) => {
  const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  res.json({ tickets });
});

adminRouter.patch('/admin/support-tickets/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ status: z.enum(['Open', 'In Progress', 'Resolved']) });
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ error: 'Invalid ticket update.' });
  await db.update(supportTickets).set({ status: parsed.data.status }).where(eq(supportTickets.id, id));
  res.json({ ok: true });
});
