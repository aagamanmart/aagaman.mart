import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  cartItems,
  carts,
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
  reviews,
  shipping,
  siteSettings,
} from '../../db/schema.ts';
import { createRateLimiter } from '../../lib/security.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';

export const ordersPaymentsRouter = Router();
const checkoutLimiter = createRateLimiter(60_000, 15);

declare global {
  var _aagamanSandboxRzpSecret: string | undefined;
}

function getRazorpaySecretForVerification(): { secret: string; isSandbox: boolean } {
  if (process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET.trim().length > 0) {
    return { secret: process.env.RAZORPAY_KEY_SECRET.trim(), isSandbox: false };
  }
  if (!global._aagamanSandboxRzpSecret) {
    global._aagamanSandboxRzpSecret = crypto.randomBytes(32).toString('hex');
  }
  return { secret: global._aagamanSandboxRzpSecret, isSandbox: true };
}

async function getStoreConfigNumbers() {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, 'store_config'))
    .limit(1);
  const val = (rows[0]?.value || {}) as Record<string, unknown>;
  return {
    freeShippingThreshold: Number(val.freeShippingThreshold) || 999,
    standardShippingCharge: Number(val.standardShippingCharge) || 49,
    expressShippingCharge: Number(val.expressShippingCharge) || 129,
  };
}

async function computeCheckoutSummary(
  userId: number,
  requestedItems: Array<{ productId: number; variantId?: number | null; quantity: number }>,
  couponCode: string | undefined,
  shippingMethod: string
) {
  if (!requestedItems.length) {
    throw new Error('Your cart is empty.');
  }

  const prodIds = [...new Set(requestedItems.map((i) => i.productId))];
  const varIds = requestedItems
    .map((i) => i.variantId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const [prodRows, varRows, imgRows, cfg] = await Promise.all([
    db.select().from(products).where(inArray(products.id, prodIds)),
    varIds.length > 0
      ? db.select().from(productVariants).where(inArray(productVariants.id, varIds))
      : Promise.resolve([]),
    db.select().from(productImages).where(inArray(productImages.productId, prodIds)),
    getStoreConfigNumbers(),
  ]);

  const prodMap = new Map(prodRows.map((p) => [p.id, p]));
  const varMap = new Map(varRows.map((v) => [v.id, v]));
  const imgMap = new Map<number, string>();
  for (const img of imgRows) {
    if (!imgMap.has(img.productId) || img.isPrimary) {
      imgMap.set(img.productId, img.imageUrl);
    }
  }

  let mrpTotal = 0;
  let subtotal = 0;
  let gstTotal = 0;
  const lineItems: Array<{
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
    categoryId: number;
  }> = [];

  for (const reqItem of requestedItems) {
    const product = prodMap.get(reqItem.productId);
    if (!product || !product.isActive) {
      throw new Error('One or more items in your cart are no longer available.');
    }
    const variant = reqItem.variantId ? varMap.get(reqItem.variantId) : null;
    const available = variant ? variant.stock : product.stock;
    if (reqItem.quantity > available) {
      throw new Error(`Insufficient stock for "${product.name}". Only ${available} available.`);
    }

    const unitPrice = product.sellingPrice + (variant?.priceAdjustment || 0);
    const itemMrp = product.mrp + (variant?.priceAdjustment || 0);
    const totalPrice = unitPrice * reqItem.quantity;

    // GST included breakdown (inclusive Indian retail pricing, shown transparently on invoice)
    const itemGst = Math.round(totalPrice - totalPrice / (1 + product.gstPercent / 100));

    mrpTotal += itemMrp * reqItem.quantity;
    subtotal += totalPrice;
    gstTotal += itemGst;

    lineItems.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      productName: product.name,
      sku: variant?.sku || product.sku,
      imageUrl: imgMap.get(product.id) || '',
      variantLabel: variant ? `${variant.color} · ${variant.size}` : 'Standard',
      quantity: reqItem.quantity,
      mrp: itemMrp,
      unitPrice,
      gstPercent: product.gstPercent,
      totalPrice,
      categoryId: product.categoryId,
    });
  }

  const discountTotal = Math.max(0, mrpTotal - subtotal);
  let couponDiscount = 0;
  let freeShippingFromCoupon = false;
  let appliedCouponCode: string | null = null;

  if (couponCode && couponCode.trim().length > 0) {
    const codeUpper = couponCode.trim().toUpperCase();
    const couponRows = await db.select().from(coupons).where(eq(coupons.code, codeUpper)).limit(1);
    const coupon = couponRows[0];
    if (!coupon || !coupon.isActive) {
      throw new Error(`Coupon "${codeUpper}" is invalid or inactive.`);
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new Error(`Coupon "${codeUpper}" has expired.`);
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new Error(`Coupon "${codeUpper}" usage limit reached.`);
    }
    if (subtotal < coupon.minOrderValue) {
      throw new Error(`Minimum order ₹${coupon.minOrderValue} required for ${codeUpper}.`);
    }
    if (coupon.firstOrderOnly) {
      const prior = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId)).limit(1);
      if (prior.length > 0) {
        throw new Error(`${codeUpper} is valid on first orders only.`);
      }
    }
    if (coupon.categoryId && !lineItems.some((l) => l.categoryId === coupon.categoryId)) {
      throw new Error(`${codeUpper} is not applicable to the categories in your cart.`);
    }
    if (coupon.productId && !lineItems.some((l) => l.productId === coupon.productId)) {
      throw new Error(`${codeUpper} is not applicable to the items in your cart.`);
    }

    appliedCouponCode = coupon.code;
    if (coupon.discountType === 'percentage') {
      couponDiscount = Math.round((subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountLimit > 0) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscountLimit);
      }
    } else if (coupon.discountType === 'fixed') {
      couponDiscount = Math.min(coupon.discountValue, subtotal);
    } else if (coupon.discountType === 'free_shipping') {
      freeShippingFromCoupon = true;
    }
  }

  let shippingCharge = 0;
  if (!freeShippingFromCoupon) {
    if (shippingMethod === 'Express Delivery') {
      shippingCharge = cfg.expressShippingCharge;
    } else {
      shippingCharge = subtotal >= cfg.freeShippingThreshold ? 0 : cfg.standardShippingCharge;
    }
  }

  const grandTotal = Math.max(1, subtotal - couponDiscount + shippingCharge);

  return {
    lineItems,
    mrpTotal,
    subtotal,
    discountTotal,
    couponCode: appliedCouponCode,
    couponDiscount,
    gstTotal,
    shippingCharge,
    grandTotal,
    freeShippingThreshold: cfg.freeShippingThreshold,
  };
}

ordersPaymentsRouter.post('/checkout/calculate', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          variantId: z.number().int().positive().nullable().optional(),
          quantity: z.number().int().min(1).max(25),
        })
      )
      .min(1),
    couponCode: z.string().optional(),
    shippingMethod: z.string().optional().default('Standard Delivery'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid checkout calculation payload.' });

  try {
    const summary = await computeCheckoutSummary(
      req.dbUser!.id,
      parsed.data.items,
      parsed.data.couponCode,
      parsed.data.shippingMethod
    );
    res.json({ summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to calculate order summary.';
    res.status(400).json({ error: message });
  }
});

ordersPaymentsRouter.post('/orders/create', requireAuth, checkoutLimiter, async (req: AuthRequest, res) => {
  const schema = z.object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          variantId: z.number().int().positive().nullable().optional(),
          quantity: z.number().int().min(1).max(25),
        })
      )
      .min(1),
    customerName: z.string().min(2).max(120),
    customerEmail: z.string().email(),
    customerPhone: z.string().min(10).max(16),
    address: z.object({
      fullName: z.string().min(2),
      phone: z.string().min(10),
      line1: z.string().min(4),
      line2: z.string().optional().default(''),
      city: z.string().min(2),
      state: z.string().min(2),
      pincode: z.string().regex(/^[1-9][0-9]{5}$/),
      landmark: z.string().optional().default(''),
      addressType: z.string().optional().default('Home'),
    }),
    shippingMethod: z.enum(['Standard Delivery', 'Express Delivery']).default('Standard Delivery'),
    paymentMethod: z.enum(['upi', 'gpay', 'phonepe', 'paytm', 'card', 'netbanking', 'wallet', 'cod']),
    couponCode: z.string().optional(),
    idempotencyKey: z.string().min(8).max(120),
    notes: z.string().max(400).optional().default(''),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid checkout fields.' });
  }

  try {
    // Prevent duplicate order submission via idempotencyKey
    const existingOrder = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, req.dbUser!.id),
          eq(orders.idempotencyKey, parsed.data.idempotencyKey)
        )
      )
      .limit(1);

    if (existingOrder[0]) {
      const existingPayment = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, existingOrder[0].id))
        .limit(1);
      return res.json({
        order: existingOrder[0],
        payment: existingPayment[0] || null,
        requiresRazorpay: existingOrder[0].paymentMethod !== 'cod' && existingOrder[0].paymentStatus === 'pending',
      });
    }

    const summary = await computeCheckoutSummary(
      req.dbUser!.id,
      parsed.data.items,
      parsed.data.couponCode,
      parsed.data.shippingMethod
    );

    const isCod = parsed.data.paymentMethod === 'cod';
    const orderNumber = `AGM-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
    const trackingNumber = `TRK${crypto.randomInt(10000000, 99999999)}IN`;
    const estDays = parsed.data.shippingMethod === 'Express Delivery' ? 1 : 3;
    const estDelivery = new Date(Date.now() + estDays * 86400000).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // If online payment, create Razorpay order (live API if configured, else signed sandbox order)
    let razorpayOrderId: string | null = null;
    let razorpayMode: 'live' | 'sandbox' = 'sandbox';

    if (!isCod) {
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        razorpayMode = 'live';
        const authBasic = Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authBasic}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: summary.grandTotal * 100,
            currency: 'INR',
            receipt: orderNumber,
            notes: { orderNumber, userId: String(req.dbUser!.id) },
          }),
        });
        const rzpJson = (await rzpRes.json()) as { id?: string; error?: { description?: string } };
        if (!rzpRes.ok || !rzpJson.id) {
          throw new Error(rzpJson.error?.description || 'Unable to initiate Razorpay checkout.');
        }
        razorpayOrderId = rzpJson.id;
      } else {
        razorpayOrderId = `order_rzp_test_${crypto.randomBytes(6).toString('hex')}`;
      }
    }

    const created = await db.transaction(async (tx) => {
      // For COD, validate and decrement stock immediately in transaction
      if (isCod) {
        for (const item of summary.lineItems) {
          const updatedProd = await tx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${item.quantity}`,
              soldCount: sql`${products.soldCount} + ${item.quantity}`,
            })
            .where(and(eq(products.id, item.productId), sql`${products.stock} >= ${item.quantity}`))
            .returning({ id: products.id });

          if (!updatedProd[0]) {
            throw new Error(`"${item.productName}" just went out of stock.`);
          }
          if (item.variantId) {
            await tx
              .update(productVariants)
              .set({ stock: sql`GREATEST(0, ${productVariants.stock} - ${item.quantity})` })
              .where(eq(productVariants.id, item.variantId));
          }
        }
        if (summary.couponCode) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.code, summary.couponCode));
        }
      }

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: req.dbUser!.id,
          customerName: parsed.data.customerName.trim(),
          customerEmail: parsed.data.customerEmail.toLowerCase(),
          customerPhone: parsed.data.customerPhone.trim(),
          addressSnapshot: parsed.data.address,
          status: isCod ? 'Order Placed' : 'Payment Pending',
          paymentStatus: isCod ? 'cod_pending' : 'pending',
          paymentMethod: parsed.data.paymentMethod,
          subtotal: summary.subtotal,
          discountTotal: summary.discountTotal,
          couponCode: summary.couponCode,
          couponDiscount: summary.couponDiscount,
          gstTotal: summary.gstTotal,
          shippingCharge: summary.shippingCharge,
          grandTotal: summary.grandTotal,
          shippingMethod: parsed.data.shippingMethod,
          idempotencyKey: parsed.data.idempotencyKey,
          notes: parsed.data.notes,
        })
        .returning();

      for (const item of summary.lineItems) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          imageUrl: item.imageUrl,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          mrp: item.mrp,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          totalPrice: item.totalPrice,
        });
      }

      const [paymentRow] = await tx
        .insert(payments)
        .values({
          orderId: newOrder.id,
          userId: req.dbUser!.id,
          gateway: isCod ? 'cod' : 'razorpay',
          method: parsed.data.paymentMethod,
          razorpayOrderId,
          amount: summary.grandTotal,
          currency: 'INR',
          status: isCod ? 'cod_pending' : 'pending',
          metadata: { mode: isCod ? 'cod' : razorpayMode },
        })
        .returning();

      await tx.insert(shipping).values({
        orderId: newOrder.id,
        courierPartner:
          parsed.data.shippingMethod === 'Express Delivery' ? 'BlueDart Air Priority' : 'Delhivery Express',
        trackingNumber,
        status: isCod ? 'Order Received' : 'Awaiting Payment',
        estimatedDelivery: estDelivery,
        pincode: parsed.data.address.pincode,
        trackingHistory: [
          {
            status: isCod ? 'Order Placed' : 'Awaiting Payment',
            location: 'Mumbai Fulfillment Hub',
            timestamp: new Date().toISOString(),
            note: isCod ? 'Cash on Delivery order confirmed.' : 'Waiting for online payment confirmation.',
          },
        ],
      });

      if (isCod) {
        // Clear user's DB cart on confirmed COD order
        const userCart = await tx.select().from(carts).where(eq(carts.userId, req.dbUser!.id)).limit(1);
        if (userCart[0]) {
          await tx.delete(cartItems).where(eq(cartItems.cartId, userCart[0].id));
        }

        await tx.insert(notifications).values({
          userId: req.dbUser!.id,
          channel: 'email',
          type: 'order_confirmed',
          title: `Order ${orderNumber} Placed (COD)`,
          message: `Thank you! Your COD order of ₹${summary.grandTotal.toLocaleString('en-IN')} is confirmed and scheduled for delivery by ${estDelivery}.`,
        });
      }

      return { newOrder, paymentRow };
    });

    res.status(201).json({
      order: created.newOrder,
      payment: created.paymentRow,
      requiresRazorpay: !isCod,
      razorpay: !isCod
        ? {
            mode: razorpayMode,
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_aagaman_sandbox',
            razorpayOrderId,
            amountPaise: summary.grandTotal * 100,
            currency: 'INR',
          }
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to create order.';
    res.status(400).json({ error: message });
  }
});

// Sandbox helper: generates an authentic HMAC-SHA256 signature ONLY when RAZORPAY_KEY_SECRET is unset
ordersPaymentsRouter.post('/payments/razorpay/sandbox-sign', requireAuth, async (req: AuthRequest, res) => {
  const { secret, isSandbox } = getRazorpaySecretForVerification();
  if (!isSandbox) {
    return res.status(403).json({ error: 'Sandbox signing is disabled in live payment mode.' });
  }
  const schema = z.object({ razorpayOrderId: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid Razorpay order ID.' });

  const razorpayPaymentId = `pay_rzp_test_${crypto.randomBytes(6).toString('hex')}`;
  const razorpaySignature = crypto
    .createHmac('sha256', secret)
    .update(`${parsed.data.razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  res.json({
    razorpayOrderId: parsed.data.razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
});

ordersPaymentsRouter.post('/payments/razorpay/verify', requireAuth, checkoutLimiter, async (req: AuthRequest, res) => {
  const schema = z.object({
    orderNumber: z.string().min(4),
    razorpayOrderId: z.string().min(4),
    razorpayPaymentId: z.string().min(4),
    razorpaySignature: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing payment verification parameters.' });
  }

  try {
    const { secret } = getRazorpaySecretForVerification();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${parsed.data.razorpayOrderId}|${parsed.data.razorpayPaymentId}`)
      .digest('hex');

    const providedBuf = Buffer.from(parsed.data.razorpaySignature, 'utf-8');
    const expectedBuf = Buffer.from(expectedSig, 'utf-8');
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return res.status(400).json({ error: 'Payment signature verification failed. Order not confirmed.' });
    }

    const result = await db.transaction(async (tx) => {
      const orderRows = await tx
        .select()
        .from(orders)
        .where(
          and(eq(orders.orderNumber, parsed.data.orderNumber), eq(orders.userId, req.dbUser!.id))
        )
        .limit(1);

      const order = orderRows[0];
      if (!order) throw new Error('Order not found.');

      // Prevent duplicate payment capture
      if (order.paymentStatus === 'paid') {
        return { order, alreadyPaid: true };
      }

      const payRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.razorpayOrderId, parsed.data.razorpayOrderId)))
        .limit(1);
      if (!payRows[0]) {
        throw new Error('Matching payment transaction record not found.');
      }

      // Re-validate and decrement stock atomically
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        const updatedProd = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            soldCount: sql`${products.soldCount} + ${item.quantity}`,
          })
          .where(and(eq(products.id, item.productId), sql`${products.stock} >= ${item.quantity}`))
          .returning({ id: products.id });

        if (!updatedProd[0]) {
          throw new Error(`Stock depleted for ${item.productName}. Payment verification aborted.`);
        }
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stock: sql`GREATEST(0, ${productVariants.stock} - ${item.quantity})` })
            .where(eq(productVariants.id, item.variantId));
        }
      }

      if (order.couponCode) {
        await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(eq(coupons.code, order.couponCode));
      }

      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: 'Payment Confirmed',
          paymentStatus: 'paid',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();

      await tx
        .update(payments)
        .set({
          razorpayPaymentId: parsed.data.razorpayPaymentId,
          razorpaySignature: parsed.data.razorpaySignature,
          status: 'captured',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payRows[0].id));

      const shipRow = await tx.select().from(shipping).where(eq(shipping.orderId, order.id)).limit(1);
      const history = Array.isArray(shipRow[0]?.trackingHistory) ? shipRow[0].trackingHistory : [];
      await tx
        .update(shipping)
        .set({
          status: 'Preparing Shipment',
          trackingHistory: [
            ...history,
            {
              status: 'Payment Confirmed',
              location: 'Mumbai Fulfillment Hub',
              timestamp: new Date().toISOString(),
              note: `Payment verified (${parsed.data.razorpayPaymentId}). Preparing items for dispatch.`,
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(shipping.orderId, order.id));

      const userCart = await tx.select().from(carts).where(eq(carts.userId, req.dbUser!.id)).limit(1);
      if (userCart[0]) {
        await tx.delete(cartItems).where(eq(cartItems.cartId, userCart[0].id));
      }

      await tx.insert(notifications).values({
        userId: req.dbUser!.id,
        channel: 'email',
        type: 'payment_confirmed',
        title: `Payment Confirmed · ${order.orderNumber}`,
        message: `₹${order.grandTotal.toLocaleString('en-IN')} received securely via ${order.paymentMethod.toUpperCase()}. Your order is being packed.`,
      });

      return { order: updatedOrder, alreadyPaid: false };
    });

    res.json({ ok: true, order: result.order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment verification failed.';
    res.status(400).json({ error: message });
  }
});

ordersPaymentsRouter.post('/payments/razorpay/fail', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ orderNumber: z.string(), reason: z.string().optional().default('Payment cancelled') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request.' });

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, parsed.data.orderNumber), eq(orders.userId, req.dbUser!.id)))
    .limit(1);

  if (orderRows[0] && orderRows[0].paymentStatus === 'pending') {
    await db
      .update(orders)
      .set({ status: 'Payment Failed', paymentStatus: 'failed', updatedAt: new Date() })
      .where(eq(orders.id, orderRows[0].id));
    await db
      .update(payments)
      .set({ status: 'failed', metadata: { reason: parsed.data.reason }, updatedAt: new Date() })
      .where(eq(payments.orderId, orderRows[0].id));
  }
  res.json({ ok: true });
});

ordersPaymentsRouter.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.dbUser!.id))
      .orderBy(desc(orders.createdAt));

    if (userOrders.length === 0) return res.json({ orders: [] });
    const orderIds = userOrders.map((o) => o.id);

    const [items, ships, pays, rets, refs] = await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db.select().from(shipping).where(inArray(shipping.orderId, orderIds)),
      db.select().from(payments).where(inArray(payments.orderId, orderIds)),
      db.select().from(returns).where(inArray(returns.orderId, orderIds)),
      db.select().from(refunds).where(inArray(refunds.orderId, orderIds)),
    ]);

    res.json({
      orders: userOrders.map((o) => ({
        ...o,
        items: items.filter((i) => i.orderId === o.id),
        shipping: ships.find((s) => s.orderId === o.id) || null,
        payment: pays.find((p) => p.orderId === o.id) || null,
        returns: rets.filter((r) => r.orderId === o.id),
        refunds: refs.filter((rf) => rf.orderId === o.id),
      })),
    });
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

ordersPaymentsRouter.get('/orders/:orderNumber', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderRows = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.orderNumber, req.params.orderNumber), eq(orders.userId, req.dbUser!.id))
      )
      .limit(1);
    if (!orderRows[0]) return res.status(404).json({ error: 'Order not found.' });
    const o = orderRows[0];

    const [items, ships, pays, rets, refs] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
      db.select().from(shipping).where(eq(shipping.orderId, o.id)).limit(1),
      db.select().from(payments).where(eq(payments.orderId, o.id)).limit(1),
      db.select().from(returns).where(eq(returns.orderId, o.id)),
      db.select().from(refunds).where(eq(refunds.orderId, o.id)),
    ]);

    res.json({
      order: {
        ...o,
        items,
        shipping: ships[0] || null,
        payment: pays[0] || null,
        returns: rets,
        refunds: refs,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load order.' });
  }
});

ordersPaymentsRouter.post('/orders/:orderNumber/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.orderNumber, req.params.orderNumber), eq(orders.userId, req.dbUser!.id)))
      .limit(1);
    const order = orderRows[0];
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const cancellable = ['Order Placed', 'Payment Pending', 'Payment Confirmed', 'Processing', 'Packed'];
    if (!cancellable.includes(order.status)) {
      return res.status(400).json({ error: `Orders in "${order.status}" status cannot be cancelled directly.` });
    }

    await db.transaction(async (tx) => {
      if (order.status !== 'Payment Pending') {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        for (const item of items) {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(eq(products.id, item.productId));
          if (item.variantId) {
            await tx
              .update(productVariants)
              .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
              .where(eq(productVariants.id, item.variantId));
          }
        }
      }

      const wasPaid = order.paymentStatus === 'paid';
      await tx
        .update(orders)
        .set({
          status: wasPaid ? 'Refund Initiated' : 'Cancelled',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      if (wasPaid) {
        const payRow = await tx.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
        await tx.insert(refunds).values({
          orderId: order.id,
          paymentId: payRow[0]?.id ?? null,
          userId: req.dbUser!.id,
          amount: order.grandTotal,
          status: 'Refund Initiated',
          transactionRef: `RFD-${crypto.randomInt(100000, 999999)}`,
        });
      }

      await tx.insert(notifications).values({
        userId: req.dbUser!.id,
        channel: 'email',
        type: 'order_cancelled',
        title: `Order ${order.orderNumber} Cancelled`,
        message: wasPaid
          ? `Order cancelled. Refund of ₹${order.grandTotal.toLocaleString('en-IN')} has been initiated to your original payment method.`
          : `Order ${order.orderNumber} has been cancelled.`,
      });
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Unable to cancel order.' });
  }
});

ordersPaymentsRouter.post('/orders/:orderNumber/return', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    reason: z.string().min(5).max(500),
    requestType: z.enum(['return', 'replacement']).default('return'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please specify a clear return reason.' });

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, req.params.orderNumber), eq(orders.userId, req.dbUser!.id)))
    .limit(1);
  const order = orderRows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'Delivered') {
    return res.status(400).json({ error: 'Returns can only be requested after delivery.' });
  }

  const [ret] = await db
    .insert(returns)
    .values({
      orderId: order.id,
      userId: req.dbUser!.id,
      reason: parsed.data.reason,
      requestType: parsed.data.requestType,
      status: 'Return Requested',
    })
    .returning();

  await db
    .update(orders)
    .set({ status: 'Return Requested', updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  res.status(201).json({ returnRequest: ret });
});

ordersPaymentsRouter.post('/products/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.id);
  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().min(3).max(120),
    comment: z.string().min(5).max(1200),
  });
  const parsed = schema.safeParse(req.body);
  if (!productId || !parsed.success) {
    return res.status(400).json({ error: 'Provide rating (1-5), title, and review comment.' });
  }

  try {
    const userOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.userId, req.dbUser!.id), eq(orders.status, 'Delivered')));
    let isVerified = false;
    if (userOrders.length > 0) {
      const purchased = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(
          and(
            inArray(orderItems.orderId, userOrders.map((o) => o.id)),
            eq(orderItems.productId, productId)
          )
        )
        .limit(1);
      isVerified = purchased.length > 0;
    }

    const [created] = await db
      .insert(reviews)
      .values({
        productId,
        userId: req.dbUser!.id,
        authorName: req.dbUser!.name,
        rating: parsed.data.rating,
        title: parsed.data.title,
        comment: parsed.data.comment,
        isVerifiedPurchase: isVerified,
      })
      .returning();

    const allReviews = await db.select({ rating: reviews.rating }).from(reviews).where(eq(reviews.productId, productId));
    const avg = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1);
    await db
      .update(products)
      .set({ ratingAvg: avg, ratingCount: allReviews.length })
      .where(eq(products.id, productId));

    res.status(201).json({ review: created, ratingAvg: avg, ratingCount: allReviews.length });
  } catch {
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});
