import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  coupons,
  productImages,
  products,
  productVariants,
  reviews,
  siteSettings,
  subcategories,
  users,
} from './schema.ts';

const IMG = {
  heroElectronics: '/src/assets/images/hero_aagaman_electronics_1795321794113.jpg',
  heroHome: '/src/assets/images/hero_aagaman_home_1795321794314.jpg',
  headphones: '/src/assets/images/prod_wireless_headphones_1795321793763.jpg',
  smartwatch: '/src/assets/images/prod_smartwatch_pro_1795321794237.jpg',
  groceries: '/src/assets/images/prod_groceries_organic_1795321794873.jpg',
  mensJacket: '/src/assets/images/prod_fashion_mens_jacket_1795321793933.jpg',
  womensKurta: '/src/assets/images/prod_fashion_womens_kurta_1795321794640.jpg',
  airFryer: '/src/assets/images/prod_kitchen_airfryer_1795321794199.jpg',
  skincare: '/src/assets/images/prod_beauty_skincare_1795321796092.jpg',
  sneakers: '/src/assets/images/prod_footwear_sneakers_1795321794437.jpg',
  brassLamp: '/src/assets/images/prod_decor_brass_lamp_1795321794677.jpg',
  fitness: '/src/assets/images/prod_fitness_dumbbells_1795321796300.jpg',
};

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Seed error:', err);
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existing = await db.select({ total: count() }).from(categories);
  if ((existing[0]?.total ?? 0) > 0) {
    return;
  }

  // 1. Seed all 16 Main Categories
  const categorySeeds = [
    {
      name: 'Groceries',
      slug: 'groceries',
      description: 'Farm-fresh organic staples, aged basmati, cold-pressed oils, and whole Indian spices.',
      imageUrl: IMG.groceries,
      displayOrder: 1,
      subs: ['Organic Staples', 'Spices & Masalas', 'Cooking Oils'],
    },
    {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Flagship audio, smartwatches, laptops, and everyday tech engineered for performance.',
      imageUrl: IMG.headphones,
      displayOrder: 2,
      subs: ['Audio & Headphones', 'Wearables', 'Laptops & Workstations'],
    },
    {
      name: 'Mobile & Accessories',
      slug: 'mobile-accessories',
      description: 'Fast GaN chargers, MagSafe cases, earbuds, and mobile gear.',
      imageUrl: IMG.smartwatch,
      displayOrder: 3,
      subs: ['Smartwatches & Bands', 'Chargers & Cables', 'Cases & Protection'],
    },
    {
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      description: 'Cookware, espresso makers, ceramic dining, and countertop essentials.',
      imageUrl: IMG.airFryer,
      displayOrder: 4,
      subs: ['Kitchen Appliances', 'Cookware & Dining', 'Coffee & Tea'],
    },
    {
      name: 'Fashion',
      slug: 'fashion',
      description: 'Curated modern apparel, festive collections, and everyday wardrobe essentials.',
      imageUrl: IMG.mensJacket,
      displayOrder: 5,
      subs: ['Seasonal Edits', 'Ethnic & Festive', 'Accessories'],
    },
    {
      name: "Men's Clothing",
      slug: 'mens-clothing',
      description: 'Structured overshirts, Supima cotton tees, chinos, and formal tailoring.',
      imageUrl: IMG.mensJacket,
      displayOrder: 6,
      subs: ['Shirts & Overshirts', 'T-Shirts & Polos', 'Trousers & Denim'],
    },
    {
      name: "Women's Clothing",
      slug: 'womens-clothing',
      description: 'Handloom kurtas, contemporary western wear, and artisanal dupattas.',
      imageUrl: IMG.womensKurta,
      displayOrder: 7,
      subs: ['Kurtas & Sets', 'Dresses & Tops', 'Sarees & Dupattas'],
    },
    {
      name: 'Kids & Baby Products',
      slug: 'kids-baby',
      description: 'Organic cotton kidswear, gentle baby skincare, and ergonomic nursery essentials.',
      imageUrl: IMG.womensKurta,
      displayOrder: 8,
      subs: ['Baby Care', 'Kids Apparel', 'Nursery & Feeding'],
    },
    {
      name: 'Beauty & Personal Care',
      slug: 'beauty-personal-care',
      description: 'Dermatologist-tested Vitamin C serums, ceramide creams, and botanical grooming.',
      imageUrl: IMG.skincare,
      displayOrder: 9,
      subs: ['Skincare & Serums', 'Haircare', 'Fragrance & Grooming'],
    },
    {
      name: 'Health & Wellness',
      slug: 'health-wellness',
      description: 'Daily nutrition, immunity supplements, herbal teas, and wellness monitors.',
      imageUrl: IMG.groceries,
      displayOrder: 10,
      subs: ['Supplements & Vitamins', 'Ayurveda & Herbal', 'Health Monitors'],
    },
    {
      name: 'Footwear',
      slug: 'footwear',
      description: 'Breathable performance runners, leather loafers, and cushioned everyday sneakers.',
      imageUrl: IMG.sneakers,
      displayOrder: 11,
      subs: ['Running & Training', 'Casual Sneakers', 'Formal & Ethnic'],
    },
    {
      name: 'Toys & Games',
      slug: 'toys-games',
      description: 'STEM building kits, wooden Montessori puzzles, and family board games.',
      imageUrl: IMG.brassLamp,
      displayOrder: 12,
      subs: ['STEM & Robotics', 'Board Games', 'Early Learning'],
    },
    {
      name: 'Sports & Fitness',
      slug: 'sports-fitness',
      description: 'Hex dumbbells, TPE yoga mats, resistance systems, and home gym equipment.',
      imageUrl: IMG.fitness,
      displayOrder: 13,
      subs: ['Strength Training', 'Yoga & Recovery', 'Outdoor Sports'],
    },
    {
      name: 'Home Decor',
      slug: 'home-decor',
      description: 'Brushed brass table lamps, hand-thrown stoneware vases, and modern accents.',
      imageUrl: IMG.brassLamp,
      displayOrder: 14,
      subs: ['Lighting & Lamps', 'Vases & Accents', 'Wall Art & Mirrors'],
    },
    {
      name: 'Stationery',
      slug: 'stationery',
      description: 'Archival notebooks, fountain pens, desk organizers, and studio supplies.',
      imageUrl: IMG.heroElectronics,
      displayOrder: 15,
      subs: ['Notebooks & Journals', 'Writing Instruments', 'Desk Organizers'],
    },
    {
      name: 'Appliances',
      slug: 'appliances',
      description: 'Energy-efficient digital air fryers, espresso machines, and precision kettles.',
      imageUrl: IMG.heroHome,
      displayOrder: 16,
      subs: ['Small Kitchen Appliances', 'Air & Water Care', 'Garment Care'],
    },
  ];

  const categoryMap = new Map<string, number>();
  const subMap = new Map<string, number>();

  for (const cat of categorySeeds) {
    const [inserted] = await db
      .insert(categories)
      .values({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        displayOrder: cat.displayOrder,
        isActive: true,
      })
      .returning();
    categoryMap.set(cat.slug, inserted.id);

    for (const subName of cat.subs) {
      const subSlug = `${cat.slug}-${subName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const [subInserted] = await db
        .insert(subcategories)
        .values({
          categoryId: inserted.id,
          name: subName,
          slug: subSlug,
          description: `${subName} under ${cat.name}`,
          isActive: true,
        })
        .returning();
      subMap.set(subSlug, subInserted.id);
    }
  }

  // 2. Seed Reviewer Customer Profile (for realistic verified reviews)
  const [reviewer] = await db
    .insert(users)
    .values({
      uid: 'seed-verified-shopper-01',
      email: 'arjun.mehta@example.in',
      name: 'Arjun Mehta',
      phone: '+91 98201 44210',
      emailVerified: true,
      phoneVerified: true,
    })
    .returning();

  // 3. Seed 17 Rich Indian E-Commerce Products across categories
  const productSeeds: Array<{
    sku: string;
    name: string;
    slug: string;
    brand: string;
    categorySlug: string;
    mrp: number;
    sellingPrice: number;
    stock: number;
    gstPercent: number;
    description: string;
    specifications: Record<string, string>;
    returnPolicy: string;
    ratingAvg: string;
    ratingCount: number;
    soldCount: number;
    isFeatured?: boolean;
    isTrending?: boolean;
    isBestSeller?: boolean;
    isNewArrival?: boolean;
    isDealOfDay?: boolean;
    images: string[];
    variants: Array<{
      sku: string;
      size: string;
      color: string;
      colorHex: string;
      priceAdjustment: number;
      stock: number;
    }>;
  }> = [
    {
      sku: 'AAG-AUD-001',
      name: 'Aurora Pro ANC Wireless Over-Ear Headphones',
      slug: 'aurora-pro-anc-wireless-headphones',
      brand: 'Aurora Acoustics',
      categorySlug: 'electronics',
      mrp: 12999,
      sellingPrice: 7499,
      stock: 34,
      gstPercent: 18,
      description:
        'Studio-grade hybrid Active Noise Cancellation up to 42dB, 40mm beryllium-coated dynamic drivers, dual-device Bluetooth 5.3 multipoint pairing, and 50-hour battery life with USB-C fast charging.',
      specifications: {
        Driver: '40mm Dynamic Beryllium',
        Battery: '50 Hours (ANC On)',
        Connectivity: 'Bluetooth 5.3 + USB-C Audio',
        Weight: '268g',
        Warranty: '1 Year Pan-India Carry-in',
      },
      returnPolicy: '7 Days Easy Replacement',
      ratingAvg: '4.8',
      ratingCount: 284,
      soldCount: 1420,
      isFeatured: true,
      isBestSeller: true,
      isDealOfDay: true,
      isTrending: true,
      images: [IMG.headphones, IMG.heroElectronics],
      variants: [
        { sku: 'AAG-AUD-001-NVY', size: 'Standard', color: 'Midnight Navy', colorHex: '#102A43', priceAdjustment: 0, stock: 22 },
        { sku: 'AAG-AUD-001-COP', size: 'Standard', color: 'Copper Slate', colorHex: '#B45309', priceAdjustment: 300, stock: 12 },
      ],
    },
    {
      sku: 'AAG-WAT-002',
      name: 'TitanPulse AMOLED Titanium Smartwatch 46mm',
      slug: 'titanpulse-amoled-titanium-smartwatch',
      brand: 'TitanPulse',
      categorySlug: 'mobile-accessories',
      mrp: 14999,
      sellingPrice: 8999,
      stock: 19,
      gstPercent: 18,
      description:
        'Aerospace-grade brushed titanium case with 1.43-inch 1000-nit LTPO AMOLED display, dual-band GPS, continuous SpO2 & heart-rate tracking, Bluetooth calling, and 10-day battery endurance.',
      specifications: {
        Display: '1.43" LTPO AMOLED (60Hz)',
        Case: 'Grade-5 Brushed Titanium',
        WaterResistance: '5 ATM / 50m',
        Battery: '10 Days Typical Use',
        Warranty: '1 Year Manufacturer Warranty',
      },
      returnPolicy: '7 Days Easy Replacement',
      ratingAvg: '4.7',
      ratingCount: 196,
      soldCount: 890,
      isFeatured: true,
      isBestSeller: true,
      isDealOfDay: true,
      isNewArrival: true,
      images: [IMG.smartwatch, IMG.heroElectronics],
      variants: [
        { sku: 'AAG-WAT-002-NVY', size: '46mm', color: 'Deep Navy Strap', colorHex: '#0B1F3A', priceAdjustment: 0, stock: 12 },
        { sku: 'AAG-WAT-002-ORG', size: '46mm', color: 'Alpine Orange Strap', colorHex: '#EA580C', priceAdjustment: 0, stock: 7 },
      ],
    },
    {
      sku: 'AAG-GRO-003',
      name: 'Pristine Organic Reserve Pantry Combo (Basmati, Spices & Cold-Pressed Oil)',
      slug: 'pristine-organic-reserve-pantry-combo',
      brand: 'Pristine Farms',
      categorySlug: 'groceries',
      mrp: 2450,
      sellingPrice: 1699,
      stock: 64,
      gstPercent: 5,
      description:
        'Single-origin Himalayan foothills 2-year aged Organic Basmati Rice (5 kg), whole Malabar cardamom & Tellicherry peppercorn blend (400 g glass jar), and wood-pressed extra-virgin groundnut oil (500 ml).',
      specifications: {
        Origin: 'Dehradun & Idukki, India',
        Certification: 'USDA & India Organic Certified',
        NetWeight: '5.9 kg Combined',
        ShelfLife: '12 Months',
      },
      returnPolicy: 'Non-returnable (Damaged/Expired replaced free within 48h)',
      ratingAvg: '4.9',
      ratingCount: 412,
      soldCount: 2650,
      isFeatured: true,
      isBestSeller: true,
      isTrending: true,
      images: [IMG.groceries],
      variants: [
        { sku: 'AAG-GRO-003-5KG', size: '5 kg Family Pack', color: 'Natural Kraft', colorHex: '#92400E', priceAdjustment: 0, stock: 44 },
        { sku: 'AAG-GRO-003-10KG', size: '10 kg Bulk Pack', color: 'Natural Kraft', colorHex: '#78350F', priceAdjustment: 1100, stock: 20 },
      ],
    },
    {
      sku: 'AAG-MEN-004',
      name: 'Aagaman Tailored Cotton Twill Overshirt & Supima Tee Duo',
      slug: 'aagaman-tailored-cotton-twill-overshirt',
      brand: 'Aagaman Atelier',
      categorySlug: 'mens-clothing',
      mrp: 4299,
      sellingPrice: 2599,
      stock: 28,
      gstPercent: 12,
      description:
        'Heavyweight 320 GSM breathable combed cotton twill overshirt in deep navy paired with an ultra-soft 100% Supima cotton crewneck t-shirt. Pre-shrunk and enzyme-washed for effortless drape.',
      specifications: {
        Fabric: '100% Combed Cotton Twill (320 GSM)',
        Fit: 'Modern Tailored Regular',
        Care: 'Machine Wash Cold',
        CountryOfOrigin: 'Tiruppur, India',
      },
      returnPolicy: '14 Days Easy Return & Size Exchange',
      ratingAvg: '4.6',
      ratingCount: 158,
      soldCount: 740,
      isFeatured: true,
      isTrending: true,
      isNewArrival: true,
      images: [IMG.mensJacket],
      variants: [
        { sku: 'AAG-MEN-004-M', size: 'M', color: 'Midnight Navy', colorHex: '#0F172A', priceAdjustment: 0, stock: 10 },
        { sku: 'AAG-MEN-004-L', size: 'L', color: 'Midnight Navy', colorHex: '#0F172A', priceAdjustment: 0, stock: 12 },
        { sku: 'AAG-MEN-004-XL', size: 'XL', color: 'Midnight Navy', colorHex: '#0F172A', priceAdjustment: 0, stock: 6 },
      ],
    },
    {
      sku: 'AAG-WMN-005',
      name: 'Vastra Handloom Burnt-Orange Zari Kurta & Chanderi Dupatta Set',
      slug: 'vastra-handloom-burnt-orange-kurta-set',
      brand: 'Vastra Heritage',
      categorySlug: 'womens-clothing',
      mrp: 5499,
      sellingPrice: 3299,
      stock: 22,
      gstPercent: 12,
      description:
        'Artisanal handwoven cotton-silk festive kurta in warm terracotta orange accented with delicate antique gold zari embroidery, paired with a breathable Chanderi silk-blend striped dupatta.',
      specifications: {
        Fabric: '70% Handloom Cotton, 30% Mulberry Silk',
        Embroidery: 'Zari Threadwork Neckline',
        Length: 'Calf-Length Straight Cut',
        Care: 'Dry Clean Recommended',
      },
      returnPolicy: '14 Days Easy Return & Size Exchange',
      ratingAvg: '4.8',
      ratingCount: 234,
      soldCount: 1120,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: true,
      images: [IMG.womensKurta],
      variants: [
        { sku: 'AAG-WMN-005-S', size: 'S', color: 'Terracotta Orange', colorHex: '#C2410C', priceAdjustment: 0, stock: 7 },
        { sku: 'AAG-WMN-005-M', size: 'M', color: 'Terracotta Orange', colorHex: '#C2410C', priceAdjustment: 0, stock: 9 },
        { sku: 'AAG-WMN-005-L', size: 'L', color: 'Terracotta Orange', colorHex: '#C2410C', priceAdjustment: 0, stock: 6 },
      ],
    },
    {
      sku: 'AAG-APP-006',
      name: 'NexusChef 6.5L Digital Air Fryer & Precision Kettle Bundle',
      slug: 'nexuschef-digital-air-fryer-kettle-bundle',
      brand: 'NexusHome',
      categorySlug: 'appliances',
      mrp: 11999,
      sellingPrice: 6999,
      stock: 16,
      gstPercent: 18,
      description:
        '6.5-litre viewing-window digital air fryer with 360-degree rapid convection (up to 85% less oil) bundled with a 1.5L double-wall variable temperature stainless steel electric kettle.',
      specifications: {
        Capacity: '6.5L Fryer + 1.5L Kettle',
        Power: '1700W Rapid Convection',
        Presets: '8 One-Touch Indian Cooking Modes',
        Warranty: '2 Years On-Site Warranty',
      },
      returnPolicy: '10 Days Replacement Guarantee',
      ratingAvg: '4.7',
      ratingCount: 318,
      soldCount: 980,
      isFeatured: true,
      isDealOfDay: true,
      isBestSeller: true,
      images: [IMG.airFryer, IMG.heroHome],
      variants: [
        { sku: 'AAG-APP-006-CHR', size: '6.5L Combo', color: 'Matte Charcoal', colorHex: '#27272A', priceAdjustment: 0, stock: 16 },
      ],
    },
    {
      sku: 'AAG-BTY-007',
      name: 'Aura Botanicals 15% Vitamin C Serum & Ceramide Barrier Cream',
      slug: 'aura-botanicals-vitamin-c-ceramide-duo',
      brand: 'Aura Botanics',
      categorySlug: 'beauty-personal-care',
      mrp: 1998,
      sellingPrice: 1299,
      stock: 48,
      gstPercent: 18,
      description:
        'Clinically stabilized 15% Ethyl Ascorbic Acid brightening serum paired with a 5-Ceramide deep barrier repair moisturizer. Dermatologically tested, fragrance-free, and suited for humid Indian climates.',
      specifications: {
        Volume: '30ml Serum + 50ml Moisturizer',
        KeyActives: '15% Vitamin C, Ferulic Acid, 5 Ceramides',
        SkinType: 'All Skin Types',
        Formulation: 'Paraben & Sulphate Free',
      },
      returnPolicy: '7 Days Unopened Return',
      ratingAvg: '4.8',
      ratingCount: 512,
      soldCount: 3100,
      isTrending: true,
      isBestSeller: true,
      images: [IMG.skincare],
      variants: [
        { sku: 'AAG-BTY-007-DUO', size: 'Serum + Cream Duo', color: 'Amber Glass', colorHex: '#B45309', priceAdjustment: 0, stock: 48 },
      ],
    },
    {
      sku: 'AAG-FTW-008',
      name: 'StrideFlow AeroGrip Marathon Running Sneakers',
      slug: 'strideflow-aerogrip-marathon-sneakers',
      brand: 'StrideFlow',
      categorySlug: 'footwear',
      mrp: 4999,
      sellingPrice: 2899,
      stock: 31,
      gstPercent: 12,
      description:
        'Engineered dual-density nitrogen EVA midsole with breathable 3D jacquard mesh upper in signature deep navy and signal orange. High-abrasion carbon rubber outsole built for Indian roads.',
      specifications: {
        Upper: 'Breathable 3D Engineered Mesh',
        Midsole: 'Dual-Density Nitrogen Foam',
        Weight: '245g (UK 8)',
        Drop: '8mm Heel-to-Toe',
      },
      returnPolicy: '14 Days Free Size Exchange',
      ratingAvg: '4.6',
      ratingCount: 189,
      soldCount: 840,
      isDealOfDay: true,
      isTrending: true,
      isNewArrival: true,
      images: [IMG.sneakers],
      variants: [
        { sku: 'AAG-FTW-008-UK7', size: 'UK 7', color: 'Navy & Signal Orange', colorHex: '#EA580C', priceAdjustment: 0, stock: 8 },
        { sku: 'AAG-FTW-008-UK8', size: 'UK 8', color: 'Navy & Signal Orange', colorHex: '#EA580C', priceAdjustment: 0, stock: 13 },
        { sku: 'AAG-FTW-008-UK9', size: 'UK 9', color: 'Navy & Signal Orange', colorHex: '#EA580C', priceAdjustment: 0, stock: 10 },
      ],
    },
    {
      sku: 'AAG-DEC-009',
      name: 'Lumina Brushed Brass Table Lamp & Stoneware Vase Set',
      slug: 'lumina-brushed-brass-table-lamp-set',
      brand: 'Lumina Living',
      categorySlug: 'home-decor',
      mrp: 5999,
      sellingPrice: 3799,
      stock: 14,
      gstPercent: 18,
      description:
        'Solid spun brushed brass cylindrical base topped with a natural Belgian linen drum shade, accompanied by a hand-thrown matte alabaster ceramic vase.',
      specifications: {
        Material: 'Brushed Brass, Belgian Linen, Stoneware',
        BulbType: 'E27 Warm LED Included (2700K)',
        Dimensions: '44cm Height x 24cm Shade',
      },
      returnPolicy: '7 Days Breakage-Covered Replacement',
      ratingAvg: '4.9',
      ratingCount: 94,
      soldCount: 410,
      isNewArrival: true,
      isFeatured: true,
      images: [IMG.brassLamp],
      variants: [
        { sku: 'AAG-DEC-009-BRS', size: '44cm Set', color: 'Warm Brass', colorHex: '#CA8A04', priceAdjustment: 0, stock: 14 },
      ],
    },
    {
      sku: 'AAG-SPT-010',
      name: 'IronStrive Hex Dumbbell Pair (12kg x 2) & Pro Grip Yoga Mat',
      slug: 'ironstrive-hex-dumbbell-yoga-mat-kit',
      brand: 'IronStrive',
      categorySlug: 'sports-fitness',
      mrp: 5499,
      sellingPrice: 3499,
      stock: 21,
      gstPercent: 18,
      description:
        'Anti-roll virgin rubber-encased cast iron hex dumbbells with chrome knurled handles paired with an 8mm high-density closed-cell navy TPE studio mat.',
      specifications: {
        Weights: '2 x 12 kg Hex Dumbbells',
        MatThickness: '8mm High-Density TPE (183 x 61cm)',
        Grip: 'Diamond Knurled Chrome Steel',
      },
      returnPolicy: '10 Days Easy Return',
      ratingAvg: '4.7',
      ratingCount: 142,
      soldCount: 560,
      isTrending: true,
      images: [IMG.fitness],
      variants: [
        { sku: 'AAG-SPT-010-12KG', size: '12kg Pair + Mat', color: 'Matte Black & Navy', colorHex: '#1E293B', priceAdjustment: 0, stock: 21 },
      ],
    },
    {
      sku: 'AAG-HOM-011',
      name: 'BaristaPro Stainless Espresso Machine & Hammered Brass Tray',
      slug: 'baristapro-stainless-espresso-machine',
      brand: 'Bezzera Craft',
      categorySlug: 'home-kitchen',
      mrp: 29999,
      sellingPrice: 21999,
      stock: 4, // Low stock trigger!
      gstPercent: 18,
      description:
        '15-bar Italian ULKA pump brushed stainless steel espresso machine with analog pressure gauge, commercial 58mm portafilter, microfoam steam wand, and handcrafted brass serving tray.',
      specifications: {
        Pressure: '15 Bar ULKA Pump',
        Boiler: 'Dual Thermoblock Stainless',
        Portafilter: '58mm Commercial Brass',
        Warranty: '2 Years Comprehensive',
      },
      returnPolicy: '10 Days Replacement Guarantee',
      ratingAvg: '4.9',
      ratingCount: 78,
      soldCount: 230,
      isFeatured: true,
      isNewArrival: true,
      images: [IMG.heroHome, IMG.airFryer],
      variants: [
        { sku: 'AAG-HOM-011-STL', size: '1.8L Tank', color: 'Brushed Steel', colorHex: '#94A3B8', priceAdjustment: 0, stock: 4 },
      ],
    },
    {
      sku: 'AAG-ELC-012',
      name: 'NexusPro 14" Ultrabook Workstation (16GB / 1TB NVMe)',
      slug: 'nexuspro-14-ultrabook-workstation',
      brand: 'NexusCompute',
      categorySlug: 'electronics',
      mrp: 79999,
      sellingPrice: 64999,
      stock: 9,
      gstPercent: 18,
      description:
        'CNC-machined anodized aluminum 14-inch 2.8K 120Hz creator ultrabook with 16GB LPDDR5X RAM, 1TB PCIe 4.0 SSD, Wi-Fi 6E, and 16-hour battery runtime.',
      specifications: {
        Display: '14" 2.8K IPS 120Hz 100% sRGB',
        Memory: '16GB LPDDR5X + 1TB NVMe',
        Ports: '2x Thunderbolt 4, HDMI 2.1, SD',
        Weight: '1.34 kg',
      },
      returnPolicy: '7 Days Dead-on-Arrival Replacement',
      ratingAvg: '4.8',
      ratingCount: 112,
      soldCount: 390,
      isBestSeller: true,
      isDealOfDay: true,
      images: [IMG.heroElectronics],
      variants: [
        { sku: 'AAG-ELC-012-16G', size: '16GB / 1TB', color: 'Space Slate', colorHex: '#334155', priceAdjustment: 0, stock: 9 },
      ],
    },
    {
      sku: 'AAG-FSH-013',
      name: 'Heritage Linen-Cotton Everyday Capsule Wardrobe Set',
      slug: 'heritage-linen-cotton-capsule-set',
      brand: 'Aagaman Atelier',
      categorySlug: 'fashion',
      mrp: 3699,
      sellingPrice: 2199,
      stock: 25,
      gstPercent: 12,
      description:
        'Breathable coastal linen-cotton blend layering pieces tailored for Indian summers. Minimalist stitching with corozo nut buttons.',
      specifications: { Fabric: '55% European Linen, 45% Cotton', Fit: 'Relaxed Tailored' },
      returnPolicy: '14 Days Easy Return',
      ratingAvg: '4.6',
      ratingCount: 84,
      soldCount: 320,
      isNewArrival: true,
      images: [IMG.mensJacket, IMG.womensKurta],
      variants: [
        { sku: 'AAG-FSH-013-M', size: 'M', color: 'Deep Navy', colorHex: '#102A43', priceAdjustment: 0, stock: 12 },
        { sku: 'AAG-FSH-013-L', size: 'L', color: 'Terracotta', colorHex: '#C2410C', priceAdjustment: 0, stock: 13 },
      ],
    },
    {
      sku: 'AAG-KID-014',
      name: 'LittleLoom Organic Muslin Baby Swaddle & Apparel Gift Box',
      slug: 'littleloom-organic-muslin-baby-gift-box',
      brand: 'LittleLoom',
      categorySlug: 'kids-baby',
      mrp: 1799,
      sellingPrice: 1199,
      stock: 30,
      gstPercent: 5,
      description:
        'GOTS-certified 100% organic cotton muslin wraps and soft-seam everyday essentials gentle on sensitive newborn skin.',
      specifications: { Material: '100% GOTS Organic Muslin', Age: '0–12 Months' },
      returnPolicy: '14 Days Unopened Return',
      ratingAvg: '4.9',
      ratingCount: 167,
      soldCount: 680,
      isTrending: true,
      images: [IMG.womensKurta],
      variants: [
        { sku: 'AAG-KID-014-06M', size: '0–6 Months', color: 'Warm Terracotta', colorHex: '#EA580C', priceAdjustment: 0, stock: 15 },
        { sku: 'AAG-KID-014-12M', size: '6–12 Months', color: 'Ivory Cream', colorHex: '#FDE68A', priceAdjustment: 0, stock: 15 },
      ],
    },
    {
      sku: 'AAG-HLT-015',
      name: 'VedaPure Cold-Pressed Wellness & Immunity Pantry Kit',
      slug: 'vedapure-cold-pressed-wellness-kit',
      brand: 'VedaPure',
      categorySlug: 'health-wellness',
      mrp: 1899,
      sellingPrice: 1249,
      stock: 42,
      gstPercent: 12,
      description:
        'Traditional Ayurvedic whole-spice infusion blend paired with cold-pressed virgin oil and unpolished heirloom grains for daily holistic nutrition.',
      specifications: { Origin: 'Kerala & Uttarakhand', LabTested: 'Heavy-Metal & Pesticide Free' },
      returnPolicy: '7 Days Replacement',
      ratingAvg: '4.7',
      ratingCount: 115,
      soldCount: 510,
      isNewArrival: true,
      images: [IMG.groceries],
      variants: [
        { sku: 'AAG-HLT-015-STD', size: '1.5 kg Kit', color: 'Natural', colorHex: '#92400E', priceAdjustment: 0, stock: 42 },
      ],
    },
    {
      sku: 'AAG-TOY-016',
      name: 'CraftWood Architectural Block & STEM Balance Set (64 Pcs)',
      slug: 'craftwood-architectural-stem-balance-set',
      brand: 'CraftWood India',
      categorySlug: 'toys-games',
      mrp: 2299,
      sellingPrice: 1499,
      stock: 18,
      gstPercent: 12,
      description:
        'Non-toxic water-finished Channapatna beechwood architectural building blocks designed to boost spatial reasoning and creativity.',
      specifications: { Pieces: '64 Precision Blocks', AgeGroup: '4+ Years', Safety: 'BIS & EN71 Certified' },
      returnPolicy: '10 Days Easy Return',
      ratingAvg: '4.8',
      ratingCount: 73,
      soldCount: 290,
      isNewArrival: true,
      images: [IMG.brassLamp],
      variants: [
        { sku: 'AAG-TOY-016-64P', size: '64 Pieces', color: 'Natural Beech', colorHex: '#D97706', priceAdjustment: 0, stock: 18 },
      ],
    },
    {
      sku: 'AAG-STN-017',
      name: 'Aagaman Executive Desk Folio & Fountain Pen Studio Kit',
      slug: 'aagaman-executive-desk-folio-kit',
      brand: 'PaperCraft Studio',
      categorySlug: 'stationery',
      mrp: 1699,
      sellingPrice: 999,
      stock: 52,
      gstPercent: 12,
      description:
        '120 GSM archival ivory dotted hardcover journal, anodized matte navy aluminum pen, and solid brass paperweight.',
      specifications: { PaperWeight: '120 GSM Acid-Free', Pages: '192 Numbered Pages' },
      returnPolicy: '7 Days Easy Return',
      ratingAvg: '4.7',
      ratingCount: 109,
      soldCount: 620,
      isTrending: true,
      images: [IMG.heroElectronics],
      variants: [
        { sku: 'AAG-STN-017-NVY', size: 'A5 Hardcover', color: 'Midnight Navy', colorHex: '#0B1F3A', priceAdjustment: 0, stock: 52 },
      ],
    },
  ];

  for (const p of productSeeds) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) continue;
    const discountPercent = Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100);

    const [inserted] = await db
      .insert(products)
      .values({
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        description: p.description,
        brand: p.brand,
        categoryId,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        discountPercent,
        stock: p.stock,
        lowStockThreshold: 5,
        gstPercent: p.gstPercent,
        specifications: p.specifications,
        returnPolicy: p.returnPolicy,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        soldCount: p.soldCount,
        isFeatured: Boolean(p.isFeatured),
        isTrending: Boolean(p.isTrending),
        isBestSeller: Boolean(p.isBestSeller),
        isNewArrival: Boolean(p.isNewArrival),
        isDealOfDay: Boolean(p.isDealOfDay),
        isActive: true,
      })
      .returning();

    for (let i = 0; i < p.images.length; i++) {
      await db.insert(productImages).values({
        productId: inserted.id,
        imageUrl: p.images[i],
        altText: p.name,
        displayOrder: i,
        isPrimary: i === 0,
      });
    }

    for (const v of p.variants) {
      await db.insert(productVariants).values({
        productId: inserted.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        priceAdjustment: v.priceAdjustment,
        stock: v.stock,
      });
    }

    // Seed verified reviews for first 6 featured items
    if (p.isFeatured) {
      await db.insert(reviews).values([
        {
          productId: inserted.id,
          userId: reviewer.id,
          authorName: 'Arjun Mehta · Mumbai',
          rating: 5,
          title: 'Exceptional build quality and fast next-day delivery',
          comment:
            'Ordered on AAGAMAN MART with UPI and received genuine sealed packaging the very next afternoon. Matches every specification.',
          isVerifiedPurchase: true,
        },
        {
          productId: inserted.id,
          userId: reviewer.id,
          authorName: 'Priya Nair · Bengaluru',
          rating: 5,
          title: 'Worth every rupee during the Grand Aagaman Sale',
          comment:
            'Applied AAGAMAN10 at checkout for instant savings. Packaging was secure and GST invoice was ready immediately in My Orders.',
          isVerifiedPurchase: true,
        },
      ]);
    }
  }

  // 4. Seed Coupons
  const nextYear = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
  await db.insert(coupons).values([
    {
      code: 'AAGAMAN10',
      description: '10% Instant Discount up to ₹500 on orders ₹999+',
      discountType: 'percentage',
      discountValue: 10,
      minOrderValue: 999,
      maxDiscountLimit: 500,
      firstOrderOnly: false,
      usageLimit: 5000,
      expiresAt: nextYear,
      isActive: true,
    },
    {
      code: 'WELCOME200',
      description: '₹200 Off on your first AAGAMAN MART order (Min ₹799)',
      discountType: 'fixed',
      discountValue: 200,
      minOrderValue: 799,
      maxDiscountLimit: 200,
      firstOrderOnly: true,
      usageLimit: 5000,
      expiresAt: nextYear,
      isActive: true,
    },
    {
      code: 'FREESHIP',
      description: 'Free Express Pan-India Shipping on any order',
      discountType: 'free_shipping',
      discountValue: 0,
      minOrderValue: 0,
      maxDiscountLimit: 200,
      firstOrderOnly: false,
      usageLimit: 5000,
      expiresAt: nextYear,
      isActive: true,
    },
    {
      code: 'TECH15',
      description: '15% Off on Electronics up to ₹1,500 (Min ₹2,999)',
      discountType: 'percentage',
      discountValue: 15,
      minOrderValue: 2999,
      maxDiscountLimit: 1500,
      categoryId: categoryMap.get('electronics') ?? null,
      firstOrderOnly: false,
      usageLimit: 2000,
      expiresAt: nextYear,
      isActive: true,
    },
  ]);

  // 5. Seed Site Settings & Banners
  const flashSaleEndsAt = new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString();
  await db.insert(siteSettings).values([
    {
      key: 'store_config',
      value: {
        siteName: 'AAGAMAN MART',
        tagline: 'Quality That Moves You Forward.',
        announcementText: 'Grand Aagaman Sale Live — Free Shipping above ₹999 · Use code AAGAMAN10 for 10% off',
        supportEmail: 'support@aagamanmart.in',
        supportPhone: '+91 1800-202-4499',
        headquarters: 'Aagaman Commerce Tower, Bandra Kurla Complex, Mumbai 400051',
        freeShippingThreshold: 999,
        standardShippingCharge: 49,
        expressShippingCharge: 129,
        defaultGstPercent: 18,
        flashSaleTitle: 'Grand Aagaman Sale',
        flashSaleSubtitle: 'Curated flagship deals across Electronics, Home & Lifestyle with verified GST billing.',
        flashSaleEndsAt,
        socialLinks: {
          instagram: 'https://instagram.com/aagamanmart',
          twitter: 'https://x.com/aagamanmart',
          youtube: 'https://youtube.com/@aagamanmart',
        },
        banners: [
          {
            id: 'banner-1',
            kicker: 'Grand Aagaman Sale',
            title: 'Flagship Tech & Audio Built to Move You Forward',
            subtitle: 'Up to 42% off wireless ANC audio, titanium wearables, and creator workstations with instant UPI & Razorpay checkout.',
            ctaLabel: 'Shop Electronics',
            categorySlug: 'electronics',
            imageUrl: IMG.heroElectronics,
          },
          {
            id: 'banner-2',
            kicker: 'Modern Indian Living',
            title: 'Kitchen Appliances, Brassware & Organic Pantry',
            subtitle: 'Bring architectural precision to your kitchen and dining table with 2-year warranties and pan-India courier tracking.',
            ctaLabel: 'Explore Home & Kitchen',
            categorySlug: 'home-kitchen',
            imageUrl: IMG.heroHome,
          },
        ],
      },
    },
  ]);
}
