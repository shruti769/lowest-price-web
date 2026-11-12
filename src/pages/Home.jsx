import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Store, Tag, Truck, Zap } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { fetchActiveFlashSales } from '../lib/catalogue';
import { CategoryTiles, ProductShelf, SectionHeader, Skeleton } from '../components/Shelves';
import { PickupPicker } from '../components/Fulfillment';
import { sgd } from '../lib/format';

function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return [Math.floor(ms / 3600000), Math.floor((ms % 3600000) / 60000), Math.floor((ms % 60000) / 1000)].map((n) => String(n).padStart(2, '0')).join(':');
}

function Hero() {
  const { banners } = useShop();
  const main = banners[0];
  return (
    <Link to="/categories" className="group relative block overflow-hidden rounded-2xl bg-gradient-to-r from-[#0c831f] via-[#1aa035] to-[#7fd46b] px-6 py-8 text-white md:px-12 md:py-12">
      <div className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute bottom-[-60px] right-40 h-48 w-48 rounded-full bg-[#ffd84d]/30" />
      <span className="pointer-events-none absolute bottom-1/2 right-16 hidden h-44 w-44 translate-y-1/2 items-center justify-center rounded-full bg-white shadow-2xl transition duration-500 group-hover:-translate-x-2 md:flex"><img src="/img/shortcut-online-delivery.png" alt="" className="h-28 w-28 object-contain" /></span>
      <div className="relative max-w-xl">
        {main && <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">{main.title}</span>}
        <h1 className="mt-3 text-3xl font-extrabold leading-[1.1] md:text-5xl">Lowest prices on<br />everyday groceries</h1>
        <p className="mt-3 text-sm text-white/90 md:text-lg">{main?.subtitle || 'Fresh produce, daily essentials and more, delivered to your door.'}</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1f1f1f] px-5 py-3 text-sm font-extrabold transition group-hover:gap-3">{main?.cta || 'Shop Now'} <ArrowRight size={16} /></span>
      </div>
    </Link>
  );
}

function PromoCards() {
  const { settings, setMode, vouchers } = useShop();
  const top = vouchers[0];
  const cards = [
    { to: '/categories', icon: Truck, bg: 'from-[#0aa5a5] to-[#057a7a]', title: settings.deliveryFee === 0 ? 'Free delivery' : 'Delivered today', text: `Express or scheduled slots · ${settings.deliveryFee === 0 ? 'no delivery fee' : `from ${sgd(settings.deliveryFee)}`}`, cta: 'Order Now' },
    { onClick: () => setMode('STORE_PICKUP'), icon: Store, bg: 'from-[#f8c51c] to-[#f0a500]', dark: true, title: 'Store pickup', text: 'Skip delivery fees. Order online and collect at our hub in minutes.', cta: 'Pick a hub' },
    { to: '/offers', icon: Tag, bg: 'from-[#e8eaf6] to-[#c7cdf0]', dark: true, title: top ? `${top.discountType === 'percentage' ? `${top.value}%` : sgd(top.value)} off with ${top.code}` : 'Vouchers & points', text: top ? `On orders above ${sgd(top.minOrder)}` : 'Earn loyalty points on every order and redeem at checkout.', cta: 'View offers' },
  ];
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:px-0">
      {cards.map(({ to, onClick, icon: Icon, bg, title, text, cta, dark }) => {
        const inner = (
          <>
            <Icon size={70} strokeWidth={1.2} className={`absolute -bottom-2 right-3 transition duration-300 group-hover:scale-110 ${dark ? 'text-black/10' : 'text-white/20'}`} />
            <p className="max-w-[80%] text-lg font-extrabold leading-tight md:text-xl">{title}</p>
            <p className={`mt-1 max-w-[80%] text-xs leading-snug md:text-[13px] ${dark ? 'text-black/70' : 'text-white/90'}`}>{text}</p>
            <span className={`mt-4 inline-block rounded-lg px-3 py-1.5 text-xs font-extrabold ${dark ? 'bg-[#1f1f1f] text-white' : 'bg-white text-[#1f1f1f]'}`}>{cta}</span>
          </>
        );
        const cls = `group relative block w-[78%] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-5 text-left md:w-auto ${dark ? 'text-[#1f1f1f]' : 'text-white'}`;
        return to ? <Link key={title} to={to} className={cls}>{inner}</Link> : <button key={title} onClick={onClick} className={cls}>{inner}</button>;
      })}
    </div>
  );
}

function FlashRail({ sale, products }) {
  const left = useCountdown(sale.ends_at);
  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#fff1f1] to-[#fff8ef] p-4 md:p-5">
      <ProductShelf
        title={<span className="flex items-center gap-2"><Zap className="fill-[#ff3b30] text-[#ff3b30]" size={22} /> {sale.name}</span>}
        subtitle={<span>Up to {Number(sale.discount_percentage)}% off · ends in <b className="tabular-nums text-[#ff3b30]">{left}</b></span>}
        products={products}
        to="/offers"
      />
    </div>
  );
}

export default function Home() {
  const { catalogue, sections, loading, error, refresh, mode, productById } = useShop();
  const [flashSales, setFlashSales] = useState([]);
  useEffect(() => { fetchActiveFlashSales().then(setFlashSales).catch(() => {}); }, [catalogue]);
  const sale = flashSales[0];
  const saleProducts = sale ? sale.flash_sale_products.map((x) => productById.get(x.product_id)).filter(Boolean) : [];
  const byCategory = useMemo(() => catalogue.categories.map((c) => ({ ...c, products: catalogue.products.filter((p) => p.categoryId === c.id) })).filter((c) => c.products.length), [catalogue]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-4 py-4 md:space-y-10 md:py-6">
      <Hero />
      <PromoCards />

      <section>
        {loading ? <Skeleton count={6} /> : <CategoryTiles categories={catalogue.categories} limit={20} />}
      </section>

      {mode === 'STORE_PICKUP' && (
        <section>
          <SectionHeader title="Pickup from a hub near you" subtitle="Order online, collect in minutes. No delivery fees." />
          <PickupPicker showProducts />
        </section>
      )}

      {error && <div className="rounded-xl bg-[#fef2f2] p-4 text-sm text-[#991b1b]">{error} <button onClick={refresh} className="ml-2 font-bold underline">Retry</button></div>}

      {sale && saleProducts.length > 0 && <FlashRail sale={sale} products={saleProducts} />}

      {loading ? <Skeleton count={6} /> : (
        <>
          {sections.map((s) => <ProductShelf key={s.id} title={s.title} subtitle={s.subtitle || s.top_text} products={s.products.slice(0, 20)} to={s.show_see_all ? `/collection/${s.id}` : undefined} />)}
          {byCategory.map((c) => <ProductShelf key={c.id} title={c.name} products={c.products.slice(0, 20)} to={`/category/${c.id}`} />)}
        </>
      )}
    </div>
  );
}
