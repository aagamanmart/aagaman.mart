import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  categories,
  coupons,
  newsletterSubscribers,
  productImages,
  products,
  productVariants,
  reviews,
  siteSettings,
  subcategories,
  supportTickets,
} from '../../db/schema.ts';
import { ensureSeeded } from '../../db/seed.ts';
import { optionalAuth, type AuthRequest } from '../../middleware/auth.ts';

export const storefrontRouter = Router();

storefrontRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'aagaman-mart' });
});

storefrontRouter.get('/store/config', async (_req, res) => {
  try {
    await ensureSeeded();
    const settingsRows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, 'store_config'))
      .limit(1);

    const activeCoupons = await db
      .select({
        code: coupons.code,
        description: coupons.description,
        discountType: coupons.discountType,
        discountValue: coupons.discountValue,
        minOrderValue: coupons.minOrderValue,
      })
      .from(coupons)
      .where(eq(coupons.isActive, true))
      .limit(6);

    const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    res.json({
      config: settingsRows[0]?.value || {},
      coupons: activeCoupons,
      payment: {
        mode: razorpayConfigured ? 'live' : 'sandbox',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      },
    });
  } catch (error) {
    console.error('Failed to fetch store config:', error);
    res.status(500).json({ error: 'Failed to load store configuration.' });
  }
});

storefrontRouter.get('/categories', async (_req, res) => {
  try {
    await ensureSeeded();
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.displayOrder), asc(categories.name));

    const subs = await db.select().from(subcategories).where(eq(subcategories.isActive, true));
    const prodCounts = await db
      .select({
        categoryId: products.categoryId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .groupBy(products.categoryId);

    const countMap = new Map(prodCounts.map((r) => [r.categoryId, r.count]));
    const subMap = new Map<number, typeof subs>();
    for (const s of subs) {
      const list = subMap.get(s.categoryId) || [];
      list.push(s);
      subMap.set(s.categoryId, list);
    }

    res.json({
      categories: cats.map((c) => ({
        ...c,
        productCount: countMap.get(c.id) || 0,
        subcategories: subMap.get(c.id) || [],
      })),
    });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

storefrontRouter.get('/products', async (req, res) => {
  try {
    await ensureSeeded();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const minPrice = Number(req.query.minPrice) || 0;
    const maxPrice = Number(req.query.maxPrice) || 0;
    const minRating = Number(req.query.minRating) || 0;
    const minDiscount = Number(req.query.minDiscount) || 0;
    const inStock = req.query.inStock === 'true';
    const flag = typeof req.query.flag === 'string' ? req.query.flag : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'popular';
    const limit = Math.min(Number(req.query.limit) || 60, 100);

    const conditions = [eq(products.isActive, true)];

    if (categorySlug && categorySlug !== 'all') {
      const catRow = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (catRow[0]) {
        conditions.push(eq(products.categoryId, catRow[0].id));
      } else {
        return res.json({ products: [], brands: [], total: 0 });
      }
    }

    if (q) {
      conditions.push(
        or(
          ilike(products.name, `%${q}%`),
          ilike(products.brand, `%${q}%`),
          ilike(products.description, `%${q}%`)
        )!
      );
    }

    if (brand && brand !== 'all') {
      conditions.push(eq(products.brand, brand));
    }
    if (minPrice > 0) {
      conditions.push(gte(products.sellingPrice, minPrice));
    }
    if (maxPrice > 0) {
      conditions.push(lte(products.sellingPrice, maxPrice));
    }
    if (minDiscount > 0) {
      conditions.push(gte(products.discountPercent, minDiscount));
    }
    if (inStock) {
      conditions.push(gte(products.stock, 1));
    }
    if (flag === 'featured') conditions.push(eq(products.isFeatured, true));
    if (flag === 'trending') conditions.push(eq(products.isTrending, true));
    if (flag === 'bestseller') conditions.push(eq(products.isBestSeller, true));
    if (flag === 'new') conditions.push(eq(products.isNewArrival, true));
    if (flag === 'deal') conditions.push(eq(products.isDealOfDay, true));

    let orderClause = desc(products.soldCount);
    if (sort === 'newest') orderClause = desc(products.createdAt);
    if (sort === 'price_asc') orderClause = asc(products.sellingPrice);
    if (sort === 'price_desc') orderClause = desc(products.sellingPrice);
    if (sort === 'rating') orderClause = desc(products.ratingAvg);

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(limit);

    const filteredRows =
      minRating > 0 ? rows.filter((p) => parseFloat(p.ratingAvg) >= minRating) : rows;

    const productIds = filteredRows.map((p) => p.id);
    const catList = await db.select().from(categories);
    const catMap = new Map(catList.map((c) => [c.id, c]));

    const imgs =
      productIds.length > 0
        ? await db
            .select()
            .from(productImages)
            .where(inArray(productImages.productId, productIds))
            .orderBy(asc(productImages.displayOrder))
        : [];
    const vars =
      productIds.length > 0
        ? await db.select().from(productVariants).where(inArray(productVariants.productId, productIds))
        : [];

    const imgMap = new Map<number, typeof imgs>();
    for (const img of imgs) {
      const list = imgMap.get(img.productId) || [];
      list.push(img);
      imgMap.set(img.productId, list);
    }

    const varMap = new Map<number, typeof vars>();
    for (const v of vars) {
      const list = varMap.get(v.productId) || [];
      list.push(v);
      varMap.set(v.productId, list);
    }

    const allBrands = await db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.brand));

    res.json({
      products: filteredRows.map((p) => ({
        ...p,
        category: catMap.get(p.categoryId) || null,
        images: imgMap.get(p.id) || [],
        variants: varMap.get(p.id) || [],
      })),
      brands: allBrands.map((b) => b.brand),
      total: filteredRows.length,
    });
  } catch (error) {
    console.error('Failed to search products:', error);
    res.status(500).json({ error: 'Failed to load products.' });
  }
});

storefrontRouter.get('/products/:slug', async (req, res) => {
  try {
    await ensureSeeded();
    const slug = req.params.slug;
    const found = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.isActive, true)))
      .limit(1);

    if (!found[0]) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const product = found[0];

    const [catRow, imgs, vars, prodReviews, relatedRows] = await Promise.all([
      db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1),
      db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, product.id))
        .orderBy(asc(productImages.displayOrder)),
      db.select().from(productVariants).where(eq(productVariants.productId, product.id)),
      db
        .select()
        .from(reviews)
        .where(eq(reviews.productId, product.id))
        .orderBy(desc(reviews.createdAt)),
      db
        .select()
        .from(products)
        .where(and(eq(products.isActive, true), sql`${products.id} != ${product.id}`))
        .orderBy(desc(products.soldCount))
        .limit(4),
    ]);

    const relatedIds = relatedRows.map((r) => r.id);
    const relatedImgs =
      relatedIds.length > 0
        ? await db.select().from(productImages).where(inArray(productImages.productId, relatedIds))
        : [];
    const relImgMap = new Map<number, typeof relatedImgs>();
    for (const ri of relatedImgs) {
      const list = relImgMap.get(ri.productId) || [];
      list.push(ri);
      relImgMap.set(ri.productId, list);
    }

    res.json({
      product: {
        ...product,
        category: catRow[0] || null,
        images: imgs,
        variants: vars,
      },
      reviews: prodReviews,
      relatedProducts: relatedRows.map((r) => ({
        ...r,
        images: relImgMap.get(r.id) || [],
      })),
    });
  } catch (error) {
    console.error('Failed to load product detail:', error);
    res.status(500).json({ error: 'Failed to load product details.' });
  }
});

storefrontRouter.get('/pincode/:code', (req, res) => {
  const code = (req.params.code || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(code)) {
    return res.status(400).json({
      serviceable: false,
      error: 'Please enter a valid 6-digit Indian pincode.',
    });
  }

  const firstDigit = code[0];
  const zoneMap: Record<string, { region: string; days: number; courier: string }> = {
    '1': { region: 'Delhi NCR & North India', days: 2, courier: 'Delhivery Express' },
    '2': { region: 'Uttar Pradesh & Uttarakhand', days: 3, courier: 'BlueDart Air' },
    '3': { region: 'Gujarat & Rajasthan', days: 2, courier: 'Delhivery Express' },
    '4': { region: 'Maharashtra, Mumbai & Goa', days: 1, courier: 'Aagaman Prime Hub' },
    '5': { region: 'Bengaluru, Hyderabad & Telangana', days: 2, courier: 'BlueDart Air' },
    '6': { region: 'Chennai, Kerala & Tamil Nadu', days: 2, courier: 'XpressBees Priority' },
    '7': { region: 'Kolkata, Odisha & East India', days: 3, courier: 'Delhivery Surface' },
    '8': { region: 'Bihar & Jharkhand', days: 4, courier: 'Delhivery Surface' },
    '9': { region: 'Army Postal & Special Zone', days: 5, courier: 'India Post Speed' },
  };

  const zone = zoneMap[firstDigit] || { region: 'Pan India', days: 3, courier: 'Delhivery Express' };
  const deliveryDate = new Date(Date.now() + zone.days * 86400000).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  res.json({
    serviceable: true,
    pincode: code,
    region: zone.region,
    courierPartner: zone.courier,
    estimatedDays: zone.days,
    estimatedDelivery: deliveryDate,
    codAvailable: firstDigit !== '9',
  });
});

storefrontRouter.post('/newsletter', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  try {
    await db
      .insert(newsletterSubscribers)
      .values({ email: parsed.data.email.toLowerCase() })
      .onConflictDoNothing();
    res.json({ ok: true, message: 'Subscribed to AAGAMAN MART updates and exclusive offers.' });
  } catch (error) {
    console.error('Newsletter subscribe failed:', error);
    res.status(500).json({ error: 'Unable to subscribe right now.' });
  }
});

storefrontRouter.post('/support', optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().max(20).optional().default(''),
    subject: z.string().min(3).max(200),
    message: z.string().min(10).max(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please complete all required support fields.' });
  }

  try {
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: req.dbUser?.id ?? null,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
        subject: parsed.data.subject,
        message: parsed.data.message,
      })
      .returning();

    res.status(201).json({
      ok: true,
      ticketId: ticket.id,
      message: `Support ticket #${ticket.id} submitted. Our team responds within 4 business hours.`,
    });
  } catch (error) {
    console.error('Support ticket error:', error);
    res.status(500).json({ error: 'Failed to submit support request.' });
  }
});
