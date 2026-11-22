import { Router } from 'express';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  cartItems,
  carts,
  coupons,
  orders,
  productImages,
  products,
  productVariants,
  wishlists,
} from '../../db/schema.ts';
import { optionalAuth, requireAuth, type AuthRequest } from '../../middleware/auth.ts';

export const cartWishlistRouter = Router();

async function getOrCreateCartId(userId: number): Promise<number> {
  const existing = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db.insert(carts).values({ userId }).onConflictDoNothing().returning();
  if (created) return created.id;
  const refetched = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  return refetched[0].id;
}

async function hydrateCart(cartId: number) {
  const items = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.createdAt));
  if (items.length === 0) return [];

  const prodIds = [...new Set(items.map((i) => i.productId))];
  const varIds = items.map((i) => i.variantId).filter((v): v is number => v !== null);

  const [prodRows, imgRows, varRows] = await Promise.all([
    db.select().from(products).where(inArray(products.id, prodIds)),
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, prodIds))
      .orderBy(asc(productImages.displayOrder)),
    varIds.length > 0
      ? db.select().from(productVariants).where(inArray(productVariants.id, varIds))
      : Promise.resolve([]),
  ]);

  const prodMap = new Map(prodRows.map((p) => [p.id, p]));
  const varMap = new Map(varRows.map((v) => [v.id, v]));
  const imgMap = new Map<number, string>();
  for (const img of imgRows) {
    if (!imgMap.has(img.productId) || img.isPrimary) {
      imgMap.set(img.productId, img.imageUrl);
    }
  }

  return items
    .map((item) => {
      const product = prodMap.get(item.productId);
      if (!product) return null;
      const variant = item.variantId ? varMap.get(item.variantId) : null;
      const unitPrice = product.sellingPrice + (variant?.priceAdjustment || 0);
      const mrp = product.mrp + (variant?.priceAdjustment || 0);
      const availableStock = variant ? variant.stock : product.stock;

      return {
        id: item.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        sku: variant?.sku || product.sku,
        imageUrl: imgMap.get(product.id) || '',
        variantLabel: variant ? `${variant.color} · ${variant.size}` : 'Standard',
        quantity: item.quantity,
        unitPrice,
        mrp,
        gstPercent: product.gstPercent,
        categoryId: product.categoryId,
        availableStock,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);
}

cartWishlistRouter.get('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const cartId = await getOrCreateCartId(req.dbUser!.id);
    const items = await hydrateCart(cartId);
    res.json({ items });
  } catch (error) {
    console.error('Load cart error:', error);
    res.status(500).json({ error: 'Failed to load cart.' });
  }
});

cartWishlistRouter.post('/cart/items', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.number().int().positive(),
    variantId: z.number().int().positive().nullable().optional().default(null),
    quantity: z.number().int().min(1).max(25).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid cart item payload.' });
  }

  try {
    const prod = await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1);
    if (!prod[0] || !prod[0].isActive) {
      return res.status(404).json({ error: 'Product unavailable.' });
    }
    let availableStock = prod[0].stock;
    if (parsed.data.variantId) {
      const variant = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, parsed.data.variantId))
        .limit(1);
      if (!variant[0] || variant[0].productId !== prod[0].id) {
        return res.status(400).json({ error: 'Selected variant not found.' });
      }
      availableStock = variant[0].stock;
    }

    const cartId = await getOrCreateCartId(req.dbUser!.id);
    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, parsed.data.productId),
          parsed.data.variantId
            ? eq(cartItems.variantId, parsed.data.variantId)
            : isNull(cartItems.variantId)
        )
      )
      .limit(1);

    const targetQty = (existing[0]?.quantity || 0) + parsed.data.quantity;
    if (targetQty > availableStock) {
      return res.status(400).json({ error: `Only ${availableStock} units available in stock.` });
    }

    if (existing[0]) {
      await db.update(cartItems).set({ quantity: targetQty }).where(eq(cartItems.id, existing[0].id));
    } else {
      await db.insert(cartItems).values({
        cartId,
        productId: parsed.data.productId,
        variantId: parsed.data.variantId,
        quantity: targetQty,
      });
    }

    const items = await hydrateCart(cartId);
    res.json({ items });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add item to cart.' });
  }
});

cartWishlistRouter.patch('/cart/items/:itemId', requireAuth, async (req: AuthRequest, res) => {
  const itemId = Number(req.params.itemId);
  const schema = z.object({ quantity: z.number().int().min(0).max(25) });
  const parsed = schema.safeParse(req.body);
  if (!itemId || !parsed.success) {
    return res.status(400).json({ error: 'Invalid quantity.' });
  }

  try {
    const cartId = await getOrCreateCartId(req.dbUser!.id);
    const item = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
      .limit(1);
    if (!item[0]) return res.status(404).json({ error: 'Cart item not found.' });

    if (parsed.data.quantity === 0) {
      await db.delete(cartItems).where(eq(cartItems.id, itemId));
    } else {
      const prod = await db.select().from(products).where(eq(products.id, item[0].productId)).limit(1);
      let maxStock = prod[0]?.stock ?? 0;
      if (item[0].variantId) {
        const v = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, item[0].variantId))
          .limit(1);
        maxStock = v[0]?.stock ?? maxStock;
      }
      if (parsed.data.quantity > maxStock) {
        return res.status(400).json({ error: `Only ${maxStock} units available.` });
      }
      await db.update(cartItems).set({ quantity: parsed.data.quantity }).where(eq(cartItems.id, itemId));
    }

    const items = await hydrateCart(cartId);
    res.json({ items });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Failed to update cart.' });
  }
});

cartWishlistRouter.delete('/cart/items/:itemId', requireAuth, async (req: AuthRequest, res) => {
  const itemId = Number(req.params.itemId);
  const cartId = await getOrCreateCartId(req.dbUser!.id);
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  const items = await hydrateCart(cartId);
  res.json({ items });
});

cartWishlistRouter.post('/cart/merge', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    items: z.array(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive().nullable().optional().default(null),
        quantity: z.number().int().min(1).max(25),
      })
    ),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid merge payload.' });

  try {
    const cartId = await getOrCreateCartId(req.dbUser!.id);
    for (const incoming of parsed.data.items) {
      const prod = await db.select().from(products).where(eq(products.id, incoming.productId)).limit(1);
      if (!prod[0] || !prod[0].isActive || prod[0].stock <= 0) continue;

      const existing = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cartId),
            eq(cartItems.productId, incoming.productId),
            incoming.variantId
              ? eq(cartItems.variantId, incoming.variantId)
              : isNull(cartItems.variantId)
          )
        )
        .limit(1);

      const qty = Math.min((existing[0]?.quantity || 0) + incoming.quantity, prod[0].stock);
      if (existing[0]) {
        await db.update(cartItems).set({ quantity: qty }).where(eq(cartItems.id, existing[0].id));
      } else {
        await db.insert(cartItems).values({
          cartId,
          productId: incoming.productId,
          variantId: incoming.variantId,
          quantity: qty,
        });
      }
    }

    const items = await hydrateCart(cartId);
    res.json({ items });
  } catch (error) {
    console.error('Cart merge error:', error);
    res.status(500).json({ error: 'Failed to merge cart.' });
  }
});

cartWishlistRouter.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, req.dbUser!.id));
    if (rows.length === 0) return res.json({ items: [] });

    const prodIds = rows.map((r) => r.productId);
    const [prodRows, imgRows] = await Promise.all([
      db.select().from(products).where(inArray(products.id, prodIds)),
      db.select().from(productImages).where(inArray(productImages.productId, prodIds)),
    ]);
    const imgMap = new Map<number, typeof imgRows>();
    for (const img of imgRows) {
      const list = imgMap.get(img.productId) || [];
      list.push(img);
      imgMap.set(img.productId, list);
    }

    res.json({
      items: prodRows.map((p) => ({
        ...p,
        images: imgMap.get(p.id) || [],
      })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load wishlist.' });
  }
});

cartWishlistRouter.post('/wishlist/toggle', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ productId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid product ID.' });

  try {
    const existing = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, req.dbUser!.id), eq(wishlists.productId, parsed.data.productId)))
      .limit(1);

    let wished = false;
    if (existing[0]) {
      await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
    } else {
      await db.insert(wishlists).values({
        userId: req.dbUser!.id,
        productId: parsed.data.productId,
      });
      wished = true;
    }

    res.json({ wished });
  } catch {
    res.status(500).json({ error: 'Failed to update wishlist.' });
  }
});

cartWishlistRouter.post('/wishlist/:productId/move-to-cart', requireAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);
  if (!productId) return res.status(400).json({ error: 'Invalid product ID.' });

  try {
    const prod = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod[0] || prod[0].stock <= 0) {
      return res.status(400).json({ error: 'Product is currently out of stock.' });
    }

    const cartId = await getOrCreateCartId(req.dbUser!.id);
    const existing = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId), isNull(cartItems.variantId)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(cartItems)
        .set({ quantity: Math.min(existing[0].quantity + 1, prod[0].stock) })
        .where(eq(cartItems.id, existing[0].id));
    } else {
      await db.insert(cartItems).values({ cartId, productId, variantId: null, quantity: 1 });
    }

    await db
      .delete(wishlists)
      .where(and(eq(wishlists.userId, req.dbUser!.id), eq(wishlists.productId, productId)));

    const items = await hydrateCart(cartId);
    res.json({ items });
  } catch {
    res.status(500).json({ error: 'Failed to move item to cart.' });
  }
});

cartWishlistRouter.post('/coupons/validate', optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    code: z.string().min(2).max(40),
    subtotal: z.number().nonnegative(),
    categoryIds: z.array(z.number().int()).optional().default([]),
    productIds: z.array(z.number().int()).optional().default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a coupon code.' });

  try {
    const found = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, parsed.data.code.trim().toUpperCase()))
      .limit(1);
    const coupon = found[0];
    if (!coupon || !coupon.isActive) {
      return res.status(404).json({ error: 'Coupon code is invalid or inactive.' });
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'This coupon has expired.' });
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Coupon redemption limit reached.' });
    }
    if (parsed.data.subtotal < coupon.minOrderValue) {
      return res.status(400).json({
        error: `Minimum order value of ₹${coupon.minOrderValue.toLocaleString('en-IN')} required for ${coupon.code}.`,
      });
    }
    if (coupon.firstOrderOnly && req.dbUser) {
      const priorOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.userId, req.dbUser.id))
        .limit(1);
      if (priorOrders.length > 0) {
        return res.status(400).json({ error: `${coupon.code} is valid only on your first AAGAMAN MART order.` });
      }
    }
    if (coupon.categoryId && !parsed.data.categoryIds.includes(coupon.categoryId)) {
      return res.status(400).json({ error: `${coupon.code} applies only to eligible category items in your cart.` });
    }
    if (coupon.productId && !parsed.data.productIds.includes(coupon.productId)) {
      return res.status(400).json({ error: `${coupon.code} is not valid for the items in your cart.` });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((parsed.data.subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountLimit > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountLimit);
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Math.min(coupon.discountValue, parsed.data.subtotal);
    }

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        freeShipping: coupon.discountType === 'free_shipping',
      },
    });
  } catch (error) {
    console.error('Coupon validate error:', error);
    res.status(500).json({ error: 'Failed to validate coupon.' });
  }
});
