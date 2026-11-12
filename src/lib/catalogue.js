// Ported from the customer app (src/lib/catalogue.ts + homepage.ts) so prices,
// promotions and flash sales are computed exactly the same way.
import { supabase } from './supabase';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80';

export async function fetchSharedCatalogue(productIds) {
  const now = new Date().toISOString();
  let productQuery = supabase
    .from('products')
    .select('id,name,price,subtitle,size,description,origin_country,nutrition_allergens,storage_instructions,ingredients,stock_quantity,bcrs_eligible,bcrs_containers,category_id,product_images(image_url,is_primary,sort_order)')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at', { ascending: false });
  if (productIds) productQuery = productQuery.in('id', productIds);

  const [categoriesResult, productsResult, promotionResult, flashResult] = await Promise.all([
    supabase.from('categories').select('id,name,image_url,show_on_home').eq('is_active', true).order('sort_order').order('name'),
    productQuery,
    supabase.from('promotions').select('discount_type,discount_value,starts_at,ends_at,promotion_products(product_id)').eq('is_active', true).lte('starts_at', now).order('created_at').order('id'),
    supabase.from('flash_sales').select('discount_percentage,starts_at,ends_at,flash_sale_products(product_id)').eq('is_active', true).lte('starts_at', now).gt('ends_at', now).order('created_at').order('id'),
  ]);
  for (const r of [categoriesResult, productsResult, promotionResult, flashResult]) if (r.error) throw r.error;

  const categories = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: typeof c.image_url === 'string' ? c.image_url : undefined,
    showOnHome: Boolean(c.show_on_home),
  }));
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const discounts = new Map();
  for (const promo of promotionResult.data ?? []) {
    if (promo.ends_at && promo.ends_at <= now) continue;
    for (const link of promo.promotion_products ?? []) discounts.set(link.product_id, { type: promo.discount_type, value: Number(promo.discount_value) });
  }
  for (const sale of flashResult.data ?? [])
    for (const link of sale.flash_sale_products ?? []) discounts.set(link.product_id, { type: 'percentage', value: Number(sale.discount_percentage), flash: true });

  const products = (productsResult.data ?? [])
    .filter((p) => names.has(p.category_id))
    .map((p) => {
      const images = [...(p.product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
      const original = Number(p.price);
      const discount = discounts.get(p.id);
      const effective = discount
        ? Math.max(0, discount.type === 'percentage' ? original * (1 - discount.value / 100) : original - discount.value)
        : original;
      return {
        id: p.id,
        name: p.name,
        subtitle: p.subtitle ?? undefined,
        size: p.size ?? undefined,
        description: p.description ?? undefined,
        originCountry: p.origin_country ?? undefined,
        nutritionAllergens: p.nutrition_allergens ?? undefined,
        storageInstructions: p.storage_instructions ?? undefined,
        ingredients: p.ingredients ?? undefined,
        stockQuantity: p.stock_quantity,
        category: names.get(p.category_id) ?? 'Other',
        categoryId: p.category_id,
        price: effective,
        oldPrice: discount ? original : undefined,
        badge: discount?.flash ? 'FLASH' : discount ? 'SALE' : undefined,
        image: images[0]?.image_url || FALLBACK_IMAGE,
        images: images.map((i) => i.image_url).filter(Boolean),
        bcrsContainerCount: p.bcrs_eligible ? Math.max(1, p.bcrs_containers) : undefined,
      };
    });

  return { categories, products };
}

export async function fetchHomepageSections() {
  const { data, error } = await supabase.rpc('get_homepage_sections');
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, total_products: Number(row.total_products) }));
}

export async function fetchActiveVouchers() {
  const { data, error } = await supabase
    .from('vouchers')
    .select('code,discount_type,discount_value,minimum_order,maximum_discount,expires_at,usage_limit,total_codes,used_count')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((v) => v.used_count < v.total_codes && (!v.expires_at || new Date(v.expires_at).getTime() > Date.now()))
    .map((v) => ({
      usageLimit: v.usage_limit,
      code: v.code,
      discountType: v.discount_type,
      value: Number(v.discount_value),
      minOrder: Number(v.minimum_order),
      maxDiscount: v.maximum_discount == null ? undefined : Number(v.maximum_discount),
      expiresAt: v.expires_at ?? undefined,
    }));
}

export async function fetchStorefrontContent() {
  const now = new Date().toISOString();
  const [settingsR, bannersR, announcementsR] = await Promise.all([
    supabase.from('storefront_settings').select('*').eq('id', true).single(),
    supabase.from('storefront_banners').select('id,title,subtitle,cta_label,type').eq('is_live', true).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`).order('sort_order'),
    supabase.from('customer_announcements').select('id,title,body,category,created_at').eq('is_active', true).lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`).order('created_at', { ascending: false }),
  ]);
  for (const r of [settingsR, bannersR, announcementsR]) if (r.error) throw r.error;
  const s = settingsR.data;
  return {
    settings: {
      deliveryFee: s.promotional_delivery_fee_enabled ? Number(s.promotional_delivery_fee) : Number(s.normal_delivery_fee),
      platformFee: Number(s.platform_fee),
      minimumOrder: Number(s.minimum_order_value),
      smallOrderFee: Number(s.small_order_fee),
      smallOrderFeeEnabled: Boolean(s.small_order_fee_enabled),
      storeIsOpen: Boolean(s.store_is_open),
      searchSuggestions: s.search_suggestions ?? [],
      termsText: String(s.terms_text || ''),
      privacyText: String(s.privacy_text || ''),
    },
    banners: (bannersR.data ?? []).map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, cta: b.cta_label, type: b.type })),
    announcements: (announcementsR.data ?? []).map((a) => ({ id: a.id, title: a.title, body: a.body, category: a.category, createdAt: a.created_at })),
  };
}

export async function fetchActiveFlashSales() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('flash_sales')
    .select('id,name,discount_percentage,starts_at,ends_at,flash_sale_products(product_id)')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('ends_at');
  if (error) throw error;
  return data ?? [];
}

// ---- helpers copied from the app ----
export function voucherEligibility(voucher, subtotal, now = Date.now()) {
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() <= now) return { eligible: false, label: 'Expired' };
  if (subtotal <= 0) return { eligible: false, label: 'Shop products' };
  if (subtotal < voucher.minOrder) return { eligible: false, label: `Add S$${(voucher.minOrder - subtotal).toFixed(2)} more` };
  return { eligible: true, label: 'Apply' };
}

export function voucherDiscount(voucher, subtotal) {
  if (!voucher) return 0;
  const raw = voucher.discountType === 'percentage' ? (subtotal * voucher.value) / 100 : voucher.value;
  return Math.min(subtotal, voucher.maxDiscount !== undefined ? Math.min(raw, voucher.maxDiscount) : raw);
}

const normalize = (v) => v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function searchProducts(products, query) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return products;
  const q = normalize(query);
  return products
    .filter((p) => {
      const text = normalize([p.name, p.category, p.subtitle, p.size].filter(Boolean).join(' '));
      return tokens.every((t) => text.includes(t));
    })
    .sort((a, b) => Number(normalize(b.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)));
}
