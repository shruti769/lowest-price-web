import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, Copy, Crown, FileText, Heart, LogOut, Pencil, Tag, Zap } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { voucherEligibility } from '../lib/catalogue';
import { ProductGrid, ProductShelf, SectionHeader } from '../components/Shelves';
import { sgd } from '../lib/format';

export function AccountPage() {
  const { user, authReady, profile, setProfile, wallet, signOut, wishlist } = useShop();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '' });
  if (!authReady) return null;
  if (!user) return <Navigate to="/login?next=/account" replace />;

  const name = profile?.fullName || user.user_metadata?.full_name || user.user_metadata?.fullName || 'Lowest Price shopper';
  const joined = profile?.joinedAt || user.created_at;
  const startEdit = () => { setForm({ fullName: profile?.fullName ?? name, email: profile?.email ?? '' }); setEditing(true); };
  const save = (e) => { e.preventDefault(); setProfile({ ...(profile ?? {}), ...form, fullName: form.fullName.trim(), email: form.email.trim() }); setEditing(false); };
  const s = wallet?.settings;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c831f] via-[#1aa035] to-[#5cc45a] p-6 text-white md:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-extrabold">{name.slice(0, 1).toUpperCase()}</span>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold">{name}</h1>
            <p className="text-sm text-white/80">{user.phone ? `+${user.phone.replace(/^\+/, '')}` : profile?.phoneNumber}</p>
            <p className="text-xs text-white/70">Member since {new Date(joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
          <button onClick={startEdit} className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/25"><Pencil size={15} /> Edit profile</button>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="card mt-4 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]">
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" className="input" />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="input" />
          <button className="btn-primary">Save</button>
        </form>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="card p-6">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted"><Crown size={18} className="text-[#e6a000]" /> Loyalty points</p>
          <p className="mt-3 text-5xl font-extrabold">{wallet?.balance ?? 0}</p>
          <p className="text-sm text-muted">points available{wallet?.debt ? ` · ${wallet.debt} owed` : ''}</p>
          {s && (
            <ul className="mt-5 space-y-1.5 text-sm text-muted">
              {s.enabled ? <>
                <li>• Earn {s.earn_per_dollar} point{s.earn_per_dollar === 1 ? '' : 's'} per S$1 spent</li>
                <li>• {s.points_per_dollar} points = S$1 off</li>
                <li>• Redeem from {s.minimum_redeem} points, up to {s.max_redeem_percent}% of an order</li>
                {s.expiry_days > 0 && <li>• Points expire after {s.expiry_days} days</li>}
              </> : <li>Loyalty programme is paused.</li>}
            </ul>
          )}
          {wallet?.history?.length > 0 && (
            <div className="mt-5 max-h-60 divide-y divide-line overflow-y-auto border-t border-line">
              {wallet.history.slice(0, 20).map((h) => (
                <div key={h.id} className="flex justify-between py-2.5 text-sm">
                  <span className="capitalize text-muted">{h.kind.toLowerCase().replace(/_/g, ' ')} · {new Date(h.created_at).toLocaleDateString('en-SG')}</span>
                  <span className={`font-bold ${h.points >= 0 ? 'text-price' : 'text-[#b91c1c]'}`}>{h.points >= 0 ? '+' : ''}{h.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card divide-y divide-line">
          {[
            ['/orders', ClipboardList, 'My orders', 'Track, reorder and view receipts'],
            ['/wishlist', Heart, 'Wishlist', `${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}`],
            ['/offers', Tag, 'Offers & vouchers', 'Codes and deals available now'],
            ['/terms', FileText, 'Terms & privacy', 'How we handle your data'],
          ].map(([to, Icon, title, sub]) => (
            <Link key={to} to={to} className="flex items-center gap-4 p-5 transition hover:bg-[#fafafa]">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft"><Icon size={20} className="text-brand" /></span>
              <span className="flex-1"><span className="block font-bold">{title}</span><span className="text-sm text-muted">{sub}</span></span>
              <ChevronRight className="text-muted" size={18} />
            </Link>
          ))}
          <button onClick={signOut} className="flex w-full items-center gap-4 p-5 text-left text-[#b91c1c] hover:bg-[#fef2f2]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fef2f2]"><LogOut size={20} /></span>
            <span className="font-bold">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function WishlistPage() {
  const { wishlist, productById, addToCart, notify } = useShop();
  const items = wishlist.map((id) => productById.get(id)).filter(Boolean);
  const share = async () => {
    const text = items.length ? `My Lowest SG Mart wishlist:\n${items.map((i) => `• ${i.name} - ${sgd(i.price)}`).join('\n')}` : 'My Lowest SG Mart wishlist is empty.';
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); notify('Wishlist copied'); } } catch { /* cancelled */ }
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-extrabold md:text-3xl">Wishlist</h1><p className="text-sm text-muted">{items.length} saved items</p></div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <button onClick={share} className="btn-ghost py-2.5">Share</button>
            <button onClick={() => { items.forEach((p) => (p.stockQuantity ?? 1) > 0 && addToCart(p)); notify('Wishlist moved to cart'); }} className="btn-primary py-2.5">Add all to cart</button>
          </div>
        )}
      </div>
      {items.length ? <ProductGrid products={items} /> : (
        <div className="py-20 text-center">
          <Heart className="mx-auto text-[#ddd]" size={56} />
          <p className="mt-4 text-lg font-bold">Your wishlist is empty</p>
          <p className="mt-1 text-muted">Tap the heart on any product to save it here.</p>
          <Link to="/" className="btn-primary mt-6">Discover products</Link>
        </div>
      )}
    </div>
  );
}

export function OffersPage() {
  const { vouchers, catalogue, totals, voucherCode, setVoucherCode, notify } = useShop();
  const flash = useMemo(() => catalogue.products.filter((p) => p.badge === 'FLASH'), [catalogue.products]);
  const sale = useMemo(() => catalogue.products.filter((p) => p.badge === 'SALE').sort((a, b) => (b.oldPrice - b.price) / b.oldPrice - (a.oldPrice - a.price) / a.oldPrice), [catalogue.products]);
  const copy = async (code) => { try { await navigator.clipboard.writeText(code); notify(`${code} copied`); } catch { notify(code); } };
  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-8">
      <div className="rounded-3xl bg-gradient-to-br from-[#ff3b30] via-[#ed0870] to-[#b5005a] p-8 text-white md:p-12">
        <p className="text-xs font-bold uppercase tracking-widest opacity-90">Save more every day</p>
        <h1 className="mt-2 text-3xl font-extrabold md:text-5xl">Offers & vouchers</h1>
        <p className="mt-3 max-w-lg text-white/85">Apply a voucher in your cart and stack it with loyalty points where allowed.</p>
      </div>

      <section>
        <SectionHeader eyebrow="Use at checkout" title="Vouchers" />
        {vouchers.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vouchers.map((v) => {
              const state = voucherEligibility(v, totals.subtotal);
              const applied = voucherCode === v.code;
              return (
                <div key={v.code} className="relative flex overflow-hidden rounded-2xl border border-line">
                  <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-brand p-3 text-center text-white">
                    <span className="text-2xl font-extrabold leading-none">{v.discountType === 'percentage' ? `${v.value}%` : sgd(v.value)}</span>
                    <span className="mt-1 text-xs font-bold">OFF</span>
                  </div>
                  <div className="flex-1 p-4">
                    <button onClick={() => copy(v.code)} className="flex items-center gap-1.5 font-extrabold tracking-wide hover:text-brand">{v.code} <Copy size={14} /></button>
                    <p className="mt-1 text-xs text-muted">Min order {sgd(v.minOrder)}{v.maxDiscount !== undefined ? ` · Max ${sgd(v.maxDiscount)} off` : ''}</p>
                    {v.expiresAt && <p className="text-xs text-muted">Valid until {new Date(v.expiresAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</p>}
                    <button onClick={() => { if (state.eligible) { setVoucherCode(v.code); notify(`${v.code} applied`); } else notify(state.label); }} className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-bold ${applied ? 'bg-[#effaf3] text-price' : 'border border-brand text-brand'}`}>
                      {applied ? 'Applied ✓' : state.eligible ? 'Apply to cart' : state.label}
                    </button>
                  </div>
                  <span className="absolute left-[106px] top-0 h-3 w-3 -translate-y-1/2 rounded-full border border-line bg-white" />
                  <span className="absolute bottom-0 left-[106px] h-3 w-3 translate-y-1/2 rounded-full border border-line bg-white" />
                </div>
              );
            })}
          </div>
        ) : <p className="text-muted">No vouchers available right now. Check back soon!</p>}
      </section>

      {flash.length > 0 && <ProductShelf eyebrow={<span className="flex items-center gap-1"><Zap size={13} /> Limited time</span>} title="Flash sale" products={flash} />}
      {sale.length > 0 && (
        <section>
          <SectionHeader eyebrow="Biggest savings first" title="On sale now" />
          <ProductGrid products={sale} />
        </section>
      )}
    </div>
  );
}

export function TermsPage() {
  const { settings } = useShop();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="title-underline text-3xl font-extrabold">Terms & privacy</h1>
      <h2 className="mt-10 text-xl font-extrabold">Terms of service</h2>
      <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{settings.termsText || 'Terms will be published soon.'}</p>
      <h2 className="mt-10 text-xl font-extrabold">Privacy policy</h2>
      <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{settings.privacyText || 'Privacy policy will be published soon.'}</p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-7xl font-extrabold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-extrabold">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
