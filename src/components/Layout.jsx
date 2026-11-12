import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, ChevronDown, ChevronRight, Heart, LogOut, Package, Search, ShoppingCart, Store, Tag, Truck, User } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { searchProducts } from '../lib/catalogue';
import { sgd } from '../lib/format';
import CartPanel from './CartPanel';

export function Logo({ className = 'h-10' }) {
  return <img src="/img/brand-logo.png" alt="Lowest Price SG Mart" className={`${className} w-auto object-contain`} />;
}

function useClickOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

function DeliveryPicker() {
  const { mode, setMode, settings, pickupSelection } = useShop();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const pickup = mode === 'STORE_PICKUP';
  return (
    <div ref={ref} className="relative min-w-0">
      <button onClick={() => setOpen((v) => !v)} className="min-w-0 text-left">
        <p className="text-[15px] font-extrabold leading-tight text-[#1f1f1f] md:text-lg">{pickup ? 'Store pickup' : 'Delivery today'}</p>
        <p className="flex items-center gap-0.5 truncate text-xs text-[#555] md:text-[13px]">
          <span className="truncate">{pickup ? (pickupSelection?.hubName ?? 'Choose a pickup hub') : `${settings.deliveryFee === 0 ? 'Free delivery' : `Delivery ${sgd(settings.deliveryFee)}`} · Min S$${settings.minimumOrder}`}</span>
          <ChevronDown size={14} className="shrink-0" />
        </p>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-3 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl">
          {[['ONLINE_DELIVERY', Truck, 'Online delivery', 'Express or scheduled, today or tomorrow'], ['STORE_PICKUP', Store, 'Store pickup', 'Free · ready in minutes at our hubs']].map(([k, Icon, t, s]) => (
            <button key={k} onClick={() => { setMode(k); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${mode === k ? 'bg-brand-soft' : 'hover:bg-[#f7f7f7]'}`}>
              <Icon size={20} className={mode === k ? 'text-brand' : 'text-muted'} />
              <span><span className="block text-sm font-bold">{t}</span><span className="text-xs text-muted">{s}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchBox({ autoFocus, onDone }) {
  const { catalogue, settings } = useShop();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(0);
  const hints = useMemo(() => {
    const h = [...settings.searchSuggestions, ...catalogue.products.slice(0, 6).map((p) => p.name)].filter(Boolean);
    return h.length ? h : ['milk', 'bread', 'eggs', 'rice'];
  }, [settings.searchSuggestions, catalogue.products]);
  useEffect(() => { const t = setInterval(() => setHint((i) => i + 1), 2500); return () => clearInterval(t); }, []);
  const results = useMemo(() => (q.trim() ? searchProducts(catalogue.products, q).slice(0, 7) : []), [q, catalogue.products]);
  const go = (to) => { navigate(to); setQ(''); setOpen(false); onDone?.(); };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`); }} className="relative w-full">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search"
        className="peer h-12 w-full rounded-xl border border-[#efefef] bg-[#f8f8f8] pl-11 pr-4 text-sm outline-none transition focus:border-[#ddd] focus:bg-white"
      />
      {!q && (
        <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 overflow-hidden text-sm text-[#828282]">
          Search “<span key={hint % hints.length} className="inline-block animate-rise">{hints[hint % hints.length]}</span>”
        </span>
      )}
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          {results.length ? (
            <div className="max-h-[70vh] overflow-y-auto py-1">
              {results.map((p) => (
                <button type="button" key={p.id} onMouseDown={() => go(`/product/${p.id}`)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#f7f7f7]">
                  <img src={p.image} alt="" className="h-10 w-10 rounded-lg border border-line object-contain" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="text-xs text-muted">{p.size ?? p.category}</span></span>
                  <span className="text-sm font-extrabold">{sgd(p.price)}</span>
                </button>
              ))}
              <button type="submit" className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-sm font-bold text-brand hover:bg-[#f7f7f7]">
                Show all results for “{q.trim()}” <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <p className="p-5 text-center text-sm text-muted">No products found for “{q.trim()}”</p>
          )}
        </div>
      )}
    </form>
  );
}

function Notifications() {
  const { announcements } = useShop();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button aria-label="Notifications" onClick={() => setOpen((v) => !v)} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f4f4f4]">
        <Bell size={20} />
        {announcements.length > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-alert" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(340px,90vw)] rounded-2xl border border-line bg-white p-3 shadow-xl">
          <p className="px-1 pb-2 font-extrabold">Notifications</p>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {announcements.length ? announcements.map((a) => (
              <div key={a.id} className="rounded-xl bg-[#f8f8f8] p-3"><p className="text-sm font-bold">{a.title}</p><p className="mt-0.5 text-xs text-muted">{a.body}</p></div>
            )) : <div className="py-8 text-center text-sm text-muted"><BellOff className="mx-auto mb-2 text-[#ccc]" />No notifications yet</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, signOut, profile } = useShop();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  if (!user) return <Link to="/login" className="hidden px-3 text-[17px] font-medium text-[#333] md:block">Login</Link>;
  return (
    <div ref={ref} className="relative hidden md:block">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 px-3 text-[17px] font-medium text-[#333]">Account <ChevronDown size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-60 rounded-2xl border border-line bg-white p-2 shadow-xl">
          <p className="px-3 pb-2 pt-1 text-sm font-extrabold">{profile?.fullName || 'My Account'}<span className="block text-xs font-normal text-muted">{user.phone ? `+${user.phone.replace(/^\+/, '')}` : ''}</span></p>
          {[['/orders', Package, 'My Orders'], ['/wishlist', Heart, 'Wishlist'], ['/offers', Tag, 'Offers & Vouchers'], ['/account', User, 'Account & Points']].map(([to, Icon, l]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#f7f7f7]"><Icon size={16} className="text-muted" /> {l}</Link>
          ))}
          <button onClick={() => { signOut(); setOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#b91c1c] hover:bg-[#fef2f2]"><LogOut size={16} /> Log out</button>
        </div>
      )}
    </div>
  );
}

function Header({ onOpenCart }) {
  const { totals, user } = useShop();
  const [mobileSearch, setMobileSearch] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[#eee] bg-white">
      <div className="flex h-[72px] items-center gap-3 px-4 md:h-20 md:gap-0 md:px-0">
        <Link to="/" className="flex h-full shrink-0 items-center md:w-44 md:justify-center md:border-r md:border-[#eee]"><Logo className="h-9 md:h-12" /></Link>
        <div className="min-w-0 flex-1 md:w-60 md:flex-none md:px-6"><DeliveryPicker /></div>
        <div className="hidden flex-1 md:block"><SearchBox /></div>
        <div className="flex items-center gap-1 md:gap-2 md:px-6">
          <Notifications />
          <AccountMenu />
          <Link to={user ? '/account' : '/login'} aria-label="Account" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f4f4] md:hidden"><User size={20} /></Link>
          <button onClick={onOpenCart} className={`hidden h-12 items-center gap-2 rounded-lg px-3 text-white transition md:flex ${totals.itemCount ? 'bg-brand hover:bg-brand-dark' : 'bg-[#e8e8e8] text-[#666]'}`}>
            <ShoppingCart size={22} className={totals.itemCount ? '' : 'text-[#666]'} />
            {totals.itemCount ? (
              <span className="text-left text-[13px] font-extrabold leading-tight">{totals.itemCount} item{totals.itemCount > 1 ? 's' : ''}<br />{sgd(totals.subtotal)}</span>
            ) : <span className="font-extrabold text-[#666]">My Cart</span>}
          </button>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <button onClick={() => setMobileSearch(true)} className="flex h-11 w-full items-center gap-3 rounded-xl border border-[#efefef] bg-[#f8f8f8] px-4 text-sm text-[#828282]"><Search size={18} className="text-[#444]" /> Search for products</button>
      </div>
      {mobileSearch && (
        <div className="fixed inset-0 z-50 bg-white p-3 md:hidden">
          <div className="flex items-center gap-2">
            <button aria-label="Back" onClick={() => setMobileSearch(false)} className="flex h-11 w-9 shrink-0 items-center justify-center"><ArrowLeft /></button>
            <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { catalogue } = useShop();
  return (
    <footer className="mt-16 border-t border-line bg-white pb-28 pt-12 md:pb-12">
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <h4 className="text-lg font-extrabold">Useful links</h4>
            <ul className="mt-4 grid grid-cols-2 gap-y-2.5 text-sm text-[#666]">
              {[['/offers', 'Offers'], ['/orders', 'My orders'], ['/wishlist', 'Wishlist'], ['/account', 'Loyalty points'], ['/categories', 'All categories'], ['/terms', 'Terms & privacy']].map(([to, l]) => <li key={to}><Link to={to} className="hover:text-ink">{l}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-extrabold">Categories <Link to="/categories" className="ml-2 text-sm font-bold text-brand">see all</Link></h4>
            <ul className="mt-4 grid grid-cols-2 gap-y-2.5 text-sm text-[#666] sm:grid-cols-3">
              {catalogue.categories.slice(0, 15).map((c) => <li key={c.id}><Link to={`/category/${c.id}`} className="hover:text-ink">{c.name}</Link></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <Logo className="h-10" />
          <p className="text-xs text-[#888]">© {new Date().getFullYear()} Lowest Price SG Mart · All prices in SGD</p>
        </div>
      </div>
    </footer>
  );
}

function MobileCartBar({ onOpenCart }) {
  const { totals, cart } = useShop();
  const { pathname } = useLocation();
  if (!totals.itemCount || ['/cart', '/checkout'].some((p) => pathname.startsWith(p))) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 md:hidden">
      <button onClick={onOpenCart} className="flex w-full items-center gap-3 rounded-xl bg-brand px-3 py-2.5 text-white shadow-[0_6px_20px_rgba(12,131,31,0.35)]">
        <span className="flex -space-x-3">
          {cart.slice(0, 3).map((l) => <img key={l.id} src={l.image} alt="" className="h-9 w-9 rounded-lg border-2 border-white bg-white object-contain" />)}
        </span>
        <span className="flex-1 text-left leading-tight"><span className="block text-sm font-extrabold">View cart</span><span className="text-xs opacity-90">{totals.itemCount} item{totals.itemCount > 1 ? 's' : ''} · {sgd(totals.subtotal)}</span></span>
        <ChevronRight />
      </button>
    </div>
  );
}

function CartDrawer({ open, onClose }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none invisible'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute right-0 top-0 h-full w-full max-w-[400px] shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {open && <CartPanel onClose={onClose} />}
      </aside>
    </div>
  );
}

function Toast() {
  const { toast } = useShop();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
      <div className="animate-rise rounded-xl bg-[#1f1f1f] px-5 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const openCart = () => (window.innerWidth < 768 ? navigate('/cart') : setCartOpen(true));
  return (
    <div className="flex min-h-screen flex-col">
      <Header onOpenCart={openCart} />
      <main className="flex-1"><Outlet /></main>
      {!['/login', '/checkout'].some((p) => pathname.startsWith(p)) && <Footer />}
      <MobileCartBar onOpenCart={openCart} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Toast />
    </div>
  );
}
