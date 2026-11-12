// Auth (phone OTP via the same edge functions), loyalty, wishlist, orders.
import { supabase } from './supabase';

export const PHONE_COUNTRIES = {
  SG: { label: 'Singapore', code: '+65', length: 8, placeholder: '91234567', flag: '/img/singapore.svg' },
  IN: { label: 'India', code: '+91', length: 10, placeholder: '9876543210', flag: '/img/india.svg' },
};

export function toAuthPhone(input, country) {
  const digits = input.replace(/\D/g, '');
  const valid = country === 'IN' ? /^[6-9]\d{9}$/.test(digits) : /^\d{8}$/.test(digits);
  return valid ? PHONE_COUNTRIES[country].code + digits : null;
}

const otpMessages = {
  invalid_phone: 'Enter a valid phone number with country code.',
  invalid_otp: 'The code is incorrect or expired. Try again or request a new code.',
  rate_limited: 'Too many attempts. Please wait before trying again.',
  captcha_required: 'Security verification is required. Please contact support.',
  sms_unavailable: 'SMS could not be sent. Please try later or contact support.',
  configuration_error: 'Phone sign-in is not configured. Please contact support.',
  verification_unavailable: 'Unable to complete sign-in. Please try again.',
  network_error: 'Connection interrupted. Please wait a minute and try again.',
};

async function invokeOtp(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code;
    try { code = (await error.context?.json())?.error?.code; } catch { /* non-JSON */ }
    throw new Error(code && otpMessages[code] ? otpMessages[code] : 'Unable to reach phone sign-in. Check your connection and try again.');
  }
  if (!data?.success) throw new Error('Unable to complete phone sign-in. Please try again.');
  return data;
}

export const sendPhoneOtp = (phone) => invokeOtp('send-otp', { phone });

export async function verifyPhoneOtp(phone, code) {
  const data = await invokeOtp('verify-otp', { phone, code });
  if (typeof data.session?.access_token !== 'string' || typeof data.session?.refresh_token !== 'string')
    throw new Error('Unable to complete sign-in. Please request a new code.');
  const { data: auth, error } = await supabase.auth.setSession(data.session);
  if (error || !auth.session) throw new Error('Could not save your login session. Please sign in again.');
  return auth.session;
}

// ---- loyalty + server-side checkout quote ----
export async function fetchLoyaltyWallet() {
  const { data, error } = await supabase.rpc('get_loyalty_wallet');
  if (error) throw error;
  return data;
}

export async function quoteRetail(items, pickup, voucher, points, tip, slot = '') {
  const delivery = !pickup && slot;
  const { data, error } = await supabase.rpc(delivery ? 'quote_delivery_order' : 'quote_retail_order', {
    p_items: items.map(({ id, quantity }) => ({ id, quantity })),
    ...(delivery ? { p_slot: slot, p_wholesale: false } : { p_pickup: pickup }),
    p_voucher: voucher,
    p_points: points,
    p_tip: tip,
  });
  if (error) {
    if (error.code === '42501') throw new Error('Could not verify checkout access. Please sign in again.');
    throw new Error(error.message);
  }
  return data;
}

// ---- wishlist ----
export async function fetchWishlistIds(userId) {
  const { data, error } = await supabase.from('wishlists').select('product_id').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.product_id);
}
export async function setWishlisted(userId, productId, on) {
  const q = on
    ? supabase.from('wishlists').upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id' })
    : supabase.from('wishlists').delete().eq('user_id', userId).eq('product_id', productId);
  const { error } = await q;
  if (error) throw error;
}

// ---- orders (same tables the app reads) ----
const retailStatus = (s) => (s === 'COMPLETED' ? 'DELIVERED' : ['CANCELLED', 'REFUNDED'].includes(s) ? 'CANCELLED' : 'ACTIVE');

export async function fetchMyOrders(userId) {
  const [pickup, wholesale, retail] = await Promise.all([
    supabase.from('pickup_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('wholesale_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('retail_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  const out = [];
  if (!retail.error)
    out.push(...(retail.data ?? []).map((r) => ({ ...r.order_snapshot, key: `RT-${r.id}`, kind: 'retail', rawStatus: r.status, retailOrderId: r.id, placedAt: r.created_at, status: retailStatus(r.status) })));
  if (!pickup.error)
    out.push(...(pickup.data ?? [])
      .filter((r) => !r.order_snapshot?.wholesale && !r.request_key?.startsWith('retail:'))
      .map((r) => ({ ...r.order_snapshot, key: `PK-${r.id}`, kind: 'pickup', rawStatus: r.status, placedAt: r.created_at, status: r.status === 'CANCELLED' ? 'CANCELLED' : r.status === 'COLLECTED' ? 'DELIVERED' : 'ACTIVE' })));
  if (!wholesale.error)
    out.push(...(wholesale.data ?? []).map((r) => ({ ...r.order_snapshot, key: `WH-${r.id}`, kind: 'wholesale', rawStatus: r.status, placedAt: r.created_at, itemCount: (r.order_snapshot?.items ?? []).reduce((n, i) => n + i.quantity, 0), status: ['CANCELLED', 'REJECTED'].includes(r.status) ? 'CANCELLED' : ['COLLECTED', 'DELIVERED'].includes(r.status) ? 'DELIVERED' : 'ACTIVE' })));
  return out.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
}

export async function fetchRetailOrder(id) {
  const { data, error } = await supabase.from('retail_orders').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function cancelRetailOrder(id) {
  const { error } = await supabase.rpc('manage_retail_order', { p_id: id, p_action: 'CANCEL' });
  if (error) throw error;
}

export async function bookOrder({ requestKey, order, voucher, points, pickup }) {
  const { data, error } = await supabase.rpc(pickup ? 'book_retail_order' : 'book_delivery_order', {
    p_request_key: requestKey,
    p_order: order,
    p_voucher: voucher,
    p_points: points,
    ...(pickup ? { p_hub_id: pickup.hubId, p_pickup_at: pickup.pickupAt, p_asap: pickup.asap } : { p_wholesale: false }),
  });
  if (error) throw new Error(error.message);
  return data;
}
