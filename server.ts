import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { categories, products } from './src/db/schema.ts';
import { ensureSeeded } from './src/db/seed.ts';
import { adminRouter } from './src/server/routes/admin.ts';
import { authRouter } from './src/server/routes/auth.ts';
import { cartWishlistRouter } from './src/server/routes/cart-wishlist.ts';
import { ordersPaymentsRouter } from './src/server/routes/orders-payments.ts';
import { storefrontRouter } from './src/server/routes/storefront.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  // Basic security headers (compatible with AI Studio iframe)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // API Routes
  app.use('/api', storefrontRouter);
  app.use('/api', authRouter);
  app.use('/api', cartWishlistRouter);
  app.use('/api', ordersPaymentsRouter);
  app.use('/api', adminRouter);

  // SEO robots.txt and dynamic sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      await ensureSeeded();
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const [cats, prods] = await Promise.all([
        db.select({ slug: categories.slug }).from(categories).where(eq(categories.isActive, true)),
        db.select({ slug: products.slug }).from(products).where(eq(products.isActive, true)),
      ]);
      const urls = [
        `${baseUrl}/`,
        `${baseUrl}/shop`,
        `${baseUrl}/support`,
        `${baseUrl}/faq`,
        ...cats.map((c) => `${baseUrl}/category/${c.slug}`),
        ...prods.map((p) => `${baseUrl}/product/${p.slug}`),
      ];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${u}</loc></url>`)
        .join('\n')}\n</urlset>`;
      res.type('application/xml').send(xml);
    } catch {
      res.status(500).send('');
    }
  });

  // Mount Vite in development, or serve built dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AAGAMAN MART server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
