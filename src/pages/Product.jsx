import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Heart, Share2, ShieldCheck, Star, Store, Truck } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { supabase } from '../lib/supabase';
import { QuantityControl } from '../components/ProductCard';
import { ProductShelf } from '../components/Shelves';
import { bcrsLabel, discountPercent, sgd } from '../lib/format';

function useReviews(productId) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ count: 0, average: 0 });
  const load = useCallback(async () => {
    if (!productId) return;
    const [page, stats] = await Promise.all([
      supabase.rpc('product_review_page', { p_product_id: productId, p_offset: 0 }),
      supabase.rpc('product_review_summary', { p_product_id: productId }),
    ]);
    if (!page.error) setReviews(page.data ?? []);
    if (!stats.error) setSummary({ count: Number(stats.data?.[0]?.review_count ?? 0), average: Number(stats.data?.[0]?.average_rating ?? 0) });
  }, [productId]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  return { reviews, summary, reload: load };
}

function Stars({ value, size = 16 }) {
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-[#e6a000] text-[#e6a000]' : 'text-[#ddd]'} />)}
    </span>
  );
}

function ReviewForm({ productId, onSaved }) {
  const { user, profile } = useShop();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!user) return <p className="text-sm text-muted"><Link to="/login" className="font-bold text-brand">Sign in</Link> to write a review.</p>;
  const submit = async (e) => {
    e.preventDefault();
    const name = (profile?.fullName || user.user_metadata?.full_name || user.user_metadata?.fullName || '').trim();
    if (!name) return setError('Add your name in your account before posting a review.');
    if (!body.trim()) return setError('Enter your review.');
    setSaving(true); setError('');
    const { error: e2 } = await supabase.from('product_reviews').upsert({ product_id: productId, user_id: user.id, display_name: name.slice(0, 80), rating, body: body.trim() }, { onConflict: 'product_id,user_id' });
    setSaving(false);
    if (e2) return setError('Could not save review. Please retry.');
    setBody(''); onSaved();
  };
  return (
    <form onSubmit={submit} className="rounded-2xl bg-[#f8f9fb] p-4">
      <p className="text-sm font-bold">Write a review</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
            <Star size={24} className={i <= rating ? 'fill-[#e6a000] text-[#e6a000]' : 'text-[#ccc]'} />
          </button>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What did you like or dislike?" className="input mt-3 resize-none bg-white" />
      {error && <p className="mt-2 text-sm text-[#b91c1c]">{error}</p>}
      <button disabled={saving} className="btn-primary mt-3 py-2.5">{saving ? 'Posting…' : 'Post review'}</button>
    </form>
  );
}

export default function Product() {
  const { id } = useParams();
  const { productById, catalogue, loading, isWishlisted, toggleWishlist, settings, notify } = useShop();
  const product = productById.get(id);
  const [selected, setSelected] = useState({ id, index: 0 });
  const active = selected.id === id ? selected.index : 0;
  const setActive = (index) => setSelected({ id, index });
  const [openInfo, setOpenInfo] = useState(['Description']);
  const [guarantee, setGuarantee] = useState(false);
  const { reviews, summary, reload } = useReviews(id);

  const related = useMemo(() => (product ? catalogue.products.filter((p) => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 16) : []), [catalogue.products, product]);

  if (!product) {
    return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-muted">{loading ? 'Loading product…' : <>This product is no longer available. <Link to="/" className="font-bold text-brand">Go home</Link></>}</div>;
  }

  const images = product.images?.length ? [...new Set(product.images)] : [product.image];
  const pct = discountPercent(product);
  const saved = isWishlisted(product.id);
  const info = [
    { title: 'Description', body: product.description },
    { title: 'Country of origin', body: product.originCountry },
    { title: 'Nutrition & Allergens', body: product.nutritionAllergens },
    { title: 'Storage', body: product.storageInstructions },
    { title: 'Ingredients', body: product.ingredients },
  ].filter((x) => x.body);
  const lowStock = product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 5;

  const share = async () => {
    const data = { title: product.name, text: `${product.name} - ${sgd(product.price)} at Lowest Price SG Mart`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(window.location.href); notify('Link copied'); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/" className="hover:text-brand">Home</Link><ChevronRight size={14} />
        <Link to={`/category/${product.categoryId}`} className="hover:text-brand">{product.category}</Link><ChevronRight size={14} />
        <span className="line-clamp-1 font-semibold text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="lg:sticky lg:top-44 lg:self-start">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-white p-6">
            <img src={images[active]} alt={product.name} className="aspect-square w-full object-contain" />
          </div>
          {images.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
              {images.map((src, i) => (
                <button key={src} onClick={() => setActive(i)} className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 ${i === active ? 'border-brand' : 'border-line'}`}>
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Link to={`/category/${product.categoryId}`} className="text-xs font-bold uppercase tracking-wider text-brand">{product.category}</Link>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl">{product.name}</h1>
          {product.subtitle && <p className="mt-2 text-muted">{product.subtitle}</p>}
          {product.size && <p className="mt-1 text-sm text-muted">{product.size}</p>}
          {summary.count > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-muted"><Stars value={summary.average} /> {summary.average.toFixed(1)} · {summary.count} review{summary.count > 1 ? 's' : ''}</a>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-extrabold">{sgd(product.price)}</span>
            {pct > 0 && <><span className="text-lg text-[#999]">MRP <span className="line-through">{sgd(product.oldPrice)}</span></span><span className="rounded-md bg-blue px-2 py-1 text-xs font-extrabold text-white">{pct}% OFF</span></>}
          </div>
          {product.bcrsContainerCount ? <p className="mt-2 text-xs text-muted">{bcrsLabel(product)}</p> : null}
          {lowStock && <p className="mt-3 text-sm font-semibold text-[#b54708]">Only {product.stockQuantity} left in stock</p>}

          <div className="mt-6 flex items-center gap-3">
            <QuantityControl product={product} size="lg" />
            <button onClick={() => toggleWishlist(product)} aria-label="Wishlist" className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${saved ? 'border-pink bg-pink-soft text-pink' : 'border-line hover:border-pink hover:text-pink'}`}>
              <Heart size={20} className={saved ? 'fill-pink' : ''} />
            </button>
            <button onClick={share} aria-label="Share" className="flex h-12 w-12 items-center justify-center rounded-xl border border-line hover:border-brand hover:text-brand"><Share2 size={20} /></button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
              <Truck className="text-brand" /><div><p className="text-sm font-bold">Delivery</p><p className="text-xs text-muted">{settings.deliveryFee === 0 ? 'Free delivery' : `From ${sgd(settings.deliveryFee)}`} · today or tomorrow</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
              <Store className="text-brand" /><div><p className="text-sm font-bold">Store pickup</p><p className="text-xs text-muted">Free · ready in minutes</p></div>
            </div>
          </div>

          <button onClick={() => setGuarantee((v) => !v)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[#effaf3] p-4 text-left">
            <ShieldCheck className="text-[#00813e]" />
            <span className="flex-1 text-sm font-bold text-[#00813e]">Lowest Price SG MART Guarantee</span>
            <ChevronDown size={18} className={`text-[#986b64] transition ${guarantee ? 'rotate-180' : ''}`} />
          </button>
          {guarantee && <p className="px-4 pt-2 text-sm text-muted">Found it cheaper nearby? We credit the difference to your LP Wallet after verification.</p>}

          <div className="mt-6 grid grid-cols-4 gap-2">
            {[['freshness', 'Freshness'], ['premium-grade', 'Premium grade'], ['cold-chain', 'Cold chain'], ['pesticide-free', 'Quality checked']].map(([img, label]) => (
              <div key={img} className="rounded-xl bg-[#f8f9fb] p-3 text-center"><img src={`/img/${img}.svg`} alt="" className="mx-auto h-8 w-8" /><p className="mt-1 text-[10px] font-semibold text-muted">{label}</p></div>
            ))}
          </div>

          {info.length > 0 && (
            <div className="mt-8 divide-y divide-line border-y border-line">
              {info.map(({ title, body }) => {
                const open = openInfo.includes(title);
                return (
                  <div key={title}>
                    <button onClick={() => setOpenInfo((v) => (open ? v.filter((x) => x !== title) : [...v, title]))} className="flex w-full items-center justify-between py-4 text-left font-bold">
                      {title} <ChevronDown size={18} className={`transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && <p className="whitespace-pre-line pb-4 text-sm leading-relaxed text-muted">{body}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <section id="reviews" className="mt-10 scroll-mt-48">
            <h2 className="text-xl font-extrabold">Ratings & reviews</h2>
            <div className="mt-5 flex items-center gap-4">
              <span className="text-4xl font-extrabold">{summary.count ? summary.average.toFixed(1) : '–'}</span>
              <div><Stars value={summary.average} size={18} /><p className="mt-1 text-sm text-muted">{summary.count} review{summary.count === 1 ? '' : 's'}</p></div>
            </div>
            <div className="mt-5 space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between"><p className="font-bold">{r.display_name}</p><Stars value={r.rating} size={14} /></div>
                  <p className="mt-2 text-sm text-muted">{r.body}</p>
                  <p className="mt-2 text-xs text-[#999]">{new Date(r.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              ))}
              {!reviews.length && <p className="text-sm text-muted">No reviews yet. Be the first to review this product.</p>}
            </div>
            <div className="mt-5"><ReviewForm productId={product.id} onSaved={reload} /></div>
          </section>
        </div>
      </div>

      {related.length > 0 && <div className="mt-16"><ProductShelf title={`Similar products`} subtitle={`More in ${product.category}`} products={related} to={`/category/${product.categoryId}`} /></div>}
    </div>
  );
}
