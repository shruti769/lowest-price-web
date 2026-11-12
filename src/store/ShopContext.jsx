/* eslint-disable react-refresh/only-export-components -- context file exports its hook + helpers */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchActiveVouchers, fetchHomepageSections, fetchSharedCatalogue, fetchStorefrontContent } from '../lib/catalogue';
import { fetchLoyaltyWallet, fetchWishlistIds, setWishlisted } from '../lib/account';
import { BCRS_DEPOSIT, readJSON, writeJSON } from '../lib/format';

const ShopContext = createContext(null);
export const useShop = () => useContext(ShopContext);

const KEYS = { cart: 'lpsg:cart', mode: 'lpsg:fulfillment', pickup: 'lpsg:pickup', wishlist: 'lpsg:wishlist', profile: 'lpsg:profile' };
const DEFAULT_SETTINGS = { deliveryFee: 3.99, platformFee: 1, minimumOrder: 15, smallOrderFee: 3.51, smallOrderFeeEnabled: true, storeIsOpen: true, searchSuggestions: [], termsText: '', privacyText: '' };

export function cartTotals(items, pickup, settings) {
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const bcrsDeposit = items.reduce((n, i) => n + (i.bcrsContainerCount ? BCRS_DEPOSIT : 0) * i.quantity, 0);
  const free = pickup || subtotal <= 0;
  const deliveryFee = free ? 0 : settings.deliveryFee;
  const platformFee = free ? 0 : settings.platformFee;
  const smallOrderFee = !free && settings.smallOrderFeeEnabled && subtotal < settings.minimumOrder ? settings.smallOrderFee : 0;
  return { itemCount, subtotal, bcrsDeposit, deliveryFee, platformFee, smallOrderFee, total: subtotal + bcrsDeposit + deliveryFee + platformFee + smallOrderFee };
}

export function ShopProvider({ children }) {
  // ---- auth ----
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  const user = session?.user ?? null;

  // ---- catalogue + storefront (live: polling + realtime like the app) ----
  const [catalogue, setCatalogue] = useState({ categories: [], products: [] });
  const [sections, setSections] = useState([]);
  const [storefront, setStorefront] = useState({ settings: DEFAULT_SETTINGS, banners: [], announcements: [] });
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [cat, secs] = await Promise.all([fetchSharedCatalogue(), fetchHomepageSections()]);
      setCatalogue(cat);
      const byId = new Map(cat.products.map((p) => [p.id, p]));
      setSections(secs.map((s) => ({ ...s, products: s.product_ids.map((id) => byId.get(id)).filter(Boolean) })).filter((s) => s.products.length));
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load products. Please try again.');
    } finally {
      setLoading(false);
    }
    fetchStorefrontContent().then(setStorefront).catch((e) => console.warn('storefront', e));
    fetchActiveVouchers().then(setVouchers).catch((e) => console.warn('vouchers', e));
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    let t;
    const channel = supabase.channel('web-catalogue-live');
    for (const table of ['products', 'categories', 'product_images', 'promotions', 'promotion_products', 'flash_sales', 'flash_sale_products'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { clearTimeout(t); t = setTimeout(refresh, 300); });
    channel.subscribe();
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(first); clearInterval(timer); clearTimeout(t); supabase.removeChannel(channel); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  const productById = useMemo(() => new Map(catalogue.products.map((p) => [p.id, p])), [catalogue.products]);

  // ---- toast ----
  const [toast, setToast] = useState('');
  const toastTimer = useRef();
  const notify = useCallback((msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2200); }, []);

  // ---- cart ----
  const [cart, setCart] = useState(() => readJSON(KEYS.cart, []));
  const [mode, setMode] = useState(() => readJSON(KEYS.mode, 'ONLINE_DELIVERY'));
  const [pickupSelection, setPickupSelection] = useState(() => readJSON(KEYS.pickup, null));
  useEffect(() => { writeJSON(KEYS.cart, cart); }, [cart]);
  useEffect(() => { writeJSON(KEYS.mode, mode); }, [mode]);
  useEffect(() => { writeJSON(KEYS.pickup, pickupSelection); }, [pickupSelection]);
  const [voucherCode, setVoucherCode] = useState(() => readJSON('lpsg:voucher', ''));
  useEffect(() => { writeJSON('lpsg:voucher', voucherCode); }, [voucherCode]);

  // Cart lines always show live catalogue price/stock (same product row the app reads).
  const liveCart = useMemo(() => cart.map((line) => {
    const p = productById.get(line.id);
    return p ? { ...p, quantity: line.quantity } : line;
  }), [cart, productById]);

  const quantityOf = useCallback((id) => cart.find((l) => l.id === id)?.quantity ?? 0, [cart]);

  const addToCart = useCallback((product, qty = 1) => {
    const current = productById.get(product.id);
    if (!current) return notify('This product is no longer available');
    const have = cart.find((l) => l.id === current.id)?.quantity ?? 0;
    if (current.stockQuantity !== undefined && have + qty > current.stockQuantity) return notify('No more stock available');
    setCart((c) => (c.some((l) => l.id === current.id) ? c.map((l) => (l.id === current.id ? { ...current, quantity: l.quantity + qty } : l)) : [...c, { ...current, quantity: qty }]));
    if (!have) notify(`${current.name} added to cart`);
  }, [cart, productById, notify]);

  const updateQuantity = useCallback((id, delta) => {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    if (delta > 0) {
      const p = productById.get(id);
      if (!p) return notify('This product is no longer available');
      if (p.stockQuantity !== undefined && line.quantity + delta > p.stockQuantity) return notify('No more stock available');
    }
    setCart((c) => c.map((l) => (l.id === id ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0));
  }, [cart, productById, notify]);

  const removeFromCart = useCallback((id) => setCart((c) => c.filter((l) => l.id !== id)), []);
  const clearCart = useCallback(() => setCart([]), []);

  // ---- wishlist (Supabase when signed in, local otherwise) ----
  const [wishlist, setWishlist] = useState(() => readJSON(KEYS.wishlist, []));
  useEffect(() => { if (!user) writeJSON(KEYS.wishlist, wishlist); }, [wishlist, user]);
  useEffect(() => {
    if (!user) return;
    fetchWishlistIds(user.id).then(setWishlist).catch((e) => console.warn('wishlist', e));
  }, [user]);
  const isWishlisted = useCallback((id) => wishlist.includes(id), [wishlist]);
  const toggleWishlist = useCallback((product) => {
    const on = !wishlist.includes(product.id);
    setWishlist((w) => (on ? [product.id, ...w] : w.filter((x) => x !== product.id)));
    notify(on ? 'Item added to wishlist' : 'Item removed from wishlist');
    if (user)
      setWishlisted(user.id, product.id, on).catch(() => {
        setWishlist((w) => (on ? w.filter((x) => x !== product.id) : [product.id, ...w]));
        notify('Could not update wishlist. Please try again.');
      });
  }, [wishlist, user, notify]);

  // ---- loyalty ----
  const [walletState, setWallet] = useState(null);
  const refreshWallet = useCallback(() => {
    if (!user) return;
    fetchLoyaltyWallet().then(setWallet).catch(() => setWallet(null));
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchLoyaltyWallet().then((w) => alive && setWallet(w)).catch(() => alive && setWallet(null));
    return () => { alive = false; };
  }, [user]);
  const wallet = user ? walletState : null;

  // ---- profile (the app keeps this on-device too) ----
  const [profile, setProfileState] = useState(() => readJSON(KEYS.profile, null));
  const setProfile = useCallback((p) => { setProfileState(p); writeJSON(KEYS.profile, p); }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setWishlist([]); setWallet(null);
    notify('Signed out');
  }, [notify]);

  const settings = storefront.settings;
  const totals = useMemo(() => cartTotals(liveCart, mode === 'STORE_PICKUP', settings), [liveCart, mode, settings]);

  const value = {
    session, user, authReady, signOut,
    catalogue, sections, productById, loading, error, refresh,
    settings, banners: storefront.banners, announcements: storefront.announcements, vouchers, setVouchers,
    cart: liveCart, totals, addToCart, updateQuantity, removeFromCart, clearCart, quantityOf,
    mode, setMode, pickupSelection, setPickupSelection, voucherCode, setVoucherCode,
    wishlist, isWishlisted, toggleWishlist,
    wallet, refreshWallet,
    profile, setProfile,
    toast, notify,
  };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
