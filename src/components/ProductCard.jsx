import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, Timer } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { supabase } from '../lib/supabase';
import { discountPercent, sgd } from '../lib/format';

const ratingCache = new Map();

function useRating(id) {
  const [rating, setRating] = useState(() => ratingCache.get(id) ?? null);
  useEffect(() => {
    if (!id || ratingCache.has(id)) return;
    let alive = true;
    supabase.rpc('product_review_summary', { p_product_id: id }).then(({ data, error }) => {
      if (error) return;
      const value = { average: Number(data?.[0]?.average_rating ?? 0), count: Number(data?.[0]?.review_count ?? 0) };
      ratingCache.set(id, value);
      if (alive) setRating(value);
    });
    return () => { alive = false; };
  }, [id]);
  return rating;
}

// Quick-commerce style ADD button that turns into a green stepper.
export function QuantityControl({ product, size = 'md' }) {
  const { quantityOf, addToCart, updateQuantity } = useShop();
  const qty = quantityOf(product.id);
  const soldOut = product.stockQuantity !== undefined && product.stockQuantity < 1;
  const atLimit = product.stockQuantity !== undefined && qty >= product.stockQuantity;
  const big = size === 'lg';
  const box = big ? 'h-11 w-36 shrink-0 text-base' : 'h-9 w-[72px] shrink-0 text-sm';
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  if (soldOut) return <span onClick={stop} className={`flex ${box} items-center justify-center rounded-lg border border-line bg-[#f5f5f5] text-[11px] font-bold text-muted`}>Out of stock</span>;
  if (!qty)
    return (
      <button aria-label={`Add ${product.name} to cart`} onClick={(e) => { stop(e); addToCart(product); }} className={`add-btn ${box}`}>
        ADD
      </button>
    );
  return (
    <div onClick={stop} className={`flex ${box} items-center justify-between rounded-lg bg-brand font-extrabold text-white`}>
      <button aria-label="Decrease quantity" onClick={() => updateQuantity(product.id, -1)} className="flex h-full flex-1 items-center justify-center text-lg leading-none">−</button>
      <span className="tabular-nums">{qty}</span>
      <button aria-label="Increase quantity" disabled={atLimit} onClick={() => updateQuantity(product.id, 1)} className="flex h-full flex-1 items-center justify-center text-lg leading-none disabled:opacity-40">+</button>
    </div>
  );
}

export default function ProductCard({ product, className = '' }) {
  const { isWishlisted, toggleWishlist, mode } = useShop();
  const rating = useRating(product.id);
  const pct = discountPercent(product);
  const saved = isWishlisted(product.id);
  const [imgFailed, setImgFailed] = useState(false);
  const soldOut = product.stockQuantity !== undefined && product.stockQuantity < 1;

  return (
    <Link to={`/product/${product.id}`} className={`group relative flex flex-col rounded-xl border border-[#e8e8e8] bg-white p-3 shadow-[0_0_10px_rgba(0,0,0,0.04)] transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] ${className}`}>
      {pct > 0 && (
        <span className="absolute left-3 top-0 z-10 rounded-b-md bg-blue px-1.5 pb-1 pt-0.5 text-center text-[9px] font-extrabold leading-tight text-white">
          {pct}%<br />OFF
        </span>
      )}
      <button
        aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product); }}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 opacity-0 transition group-hover:opacity-100 data-[on=true]:opacity-100"
        data-on={saved}
      >
        <Heart size={15} className={saved ? 'fill-pink text-pink' : 'text-[#999]'} />
      </button>
      <div className={`flex aspect-square items-center justify-center ${soldOut ? 'opacity-50 grayscale' : ''}`}>
        <img
          src={imgFailed ? '/img/brand-logo.png' : product.image}
          onError={() => setImgFailed(true)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full rounded-lg object-contain transition duration-300 group-hover:scale-[1.04]"
        />
      </div>
      <span className="mt-2 inline-flex w-fit items-center gap-1 rounded bg-[#f8f8f8] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#333]">
        <Timer size={10} /> {mode === 'STORE_PICKUP' ? 'Pickup' : 'Today'}
      </span>
      <h3 className="mt-1.5 line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-[#1f1f1f]">{product.name}</h3>
      <p className="mt-1 h-4 truncate text-xs text-muted">{product.size ?? ''}</p>
      {rating?.count > 0 ? (
        <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted"><Star size={10} className="fill-[#e6a000] text-[#e6a000]" /> {rating.average.toFixed(1)} ({rating.count})</p>
      ) : <span className="mt-0.5 h-[15px]" />}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-1 gap-y-2 pt-2">
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-extrabold text-[#1f1f1f]">{sgd(product.price)}</p>
          {pct > 0 && <p className="text-[11px] text-[#999] line-through">{sgd(product.oldPrice)}</p>}
        </div>
        <QuantityControl product={product} />
      </div>
    </Link>
  );
}
