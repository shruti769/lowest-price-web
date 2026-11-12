import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';

export function SectionHeader({ eyebrow, title, subtitle, to, linkLabel = 'see all' }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-[#1f1f1f] md:text-2xl">{title}</h2>
        {(subtitle || eyebrow) && <p className="mt-0.5 text-xs text-muted md:text-sm">{subtitle || eyebrow}</p>}
      </div>
      {to && <Link to={to} className="shrink-0 text-sm font-bold text-brand hover:underline md:text-base">{linkLabel}</Link>}
    </div>
  );
}

export function ProductShelf({ products, ...header }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  if (!products.length) return null;
  return (
    <section>
      <SectionHeader {...header} />
      <div className="group/shelf relative">
        <div ref={ref} className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
          {products.map((p) => <ProductCard key={p.id} product={p} className="w-[150px] shrink-0 snap-start md:w-[180px]" />)}
        </div>
        <button aria-label="Scroll left" onClick={() => scroll(-1)} className="absolute -left-5 top-1/3 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-white shadow-lg transition hover:scale-105 md:group-hover/shelf:flex"><ChevronLeft size={20} /></button>
        <button aria-label="Scroll right" onClick={() => scroll(1)} className="absolute -right-5 top-1/3 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-white shadow-lg transition hover:scale-105 md:group-hover/shelf:flex"><ChevronRight size={20} /></button>
      </div>
    </section>
  );
}

export function ProductGrid({ products, dense }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 ${dense ? 'lg:grid-cols-4 xl:grid-cols-5' : 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

export function CategoryTiles({ categories, limit }) {
  const list = limit ? categories.slice(0, limit) : categories;
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-10">
      {list.map((c) => (
        <Link key={c.id} to={`/category/${c.id}`} className="group text-center">
          <div className="flex aspect-[0.9] items-center justify-center overflow-hidden rounded-xl bg-[#eaf4fb] transition group-hover:shadow-md">
            {c.imageUrl ? (
              <img src={c.imageUrl} alt="" loading="lazy" className="h-[85%] w-[85%] rounded-lg object-cover transition duration-300 group-hover:scale-110" />
            ) : (
              <span className="text-2xl font-extrabold text-brand">{c.name.slice(0, 1)}</span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-tight text-[#1f1f1f] md:text-xs">{c.name}</p>
        </Link>
      ))}
    </div>
  );
}

export function Skeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-line p-3">
          <div className="aspect-square rounded-lg bg-[#f1f1f1]" />
          <div className="mt-3 h-3 w-full rounded bg-[#f1f1f1]" />
          <div className="mt-2 h-3 w-2/3 rounded bg-[#f4f4f4]" />
          <div className="mt-4 flex justify-between"><div className="h-4 w-12 rounded bg-[#f1f1f1]" /><div className="h-8 w-16 rounded-lg bg-[#f1f1f1]" /></div>
        </div>
      ))}
    </div>
  );
}
