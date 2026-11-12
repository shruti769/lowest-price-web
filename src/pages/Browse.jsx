import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { searchProducts } from '../lib/catalogue';
import { supabase } from '../lib/supabase';
import { CategoryTiles, ProductGrid, Skeleton } from '../components/Shelves';

const SORTS = {
  featured: { label: 'Featured', fn: null },
  low: { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  high: { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
  discount: { label: 'Biggest discount', fn: (a, b) => (b.oldPrice ? b.oldPrice - b.price : 0) - (a.oldPrice ? a.oldPrice - a.price : 0) },
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
};

function useSorted(products) {
  const [sort, setSort] = useState('featured');
  const [inStock, setInStock] = useState(false);
  const list = useMemo(() => {
    let out = inStock ? products.filter((p) => (p.stockQuantity ?? 1) > 0) : products;
    if (SORTS[sort].fn) out = [...out].sort(SORTS[sort].fn);
    return out;
  }, [products, sort, inStock]);
  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="hidden cursor-pointer items-center gap-2 text-sm font-semibold text-muted sm:flex">
        <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-4 w-4 accent-brand" /> In stock
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5">
        <SlidersHorizontal size={14} className="text-muted" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 bg-transparent text-xs font-bold outline-none md:text-sm">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
    </div>
  );
  return [list, controls];
}

function Crumbs({ items }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
      <Link to="/" className="hover:text-brand">Home</Link>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1"><ChevronRight size={14} />{it.to ? <Link to={it.to} className="hover:text-brand">{it.label}</Link> : <span className="font-semibold text-ink">{it.label}</span>}</span>
      ))}
    </nav>
  );
}

function Empty({ title, text }) {
  return (
    <div className="py-20 text-center">
      <PackageSearch className="mx-auto text-[#bbb]" size={48} />
      <p className="mt-4 text-lg font-bold">{title}</p>
      <p className="mt-1 text-muted">{text}</p>
      <Link to="/" className="btn-primary mt-6">Continue shopping</Link>
    </div>
  );
}

export function AllCategories() {
  const { catalogue, loading } = useShop();
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Crumbs items={[{ label: 'Categories' }]} />
            <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">All categories</h1>
      <div className="mt-8">{loading ? <Skeleton count={8} /> : <CategoryTiles categories={catalogue.categories} />}</div>
    </div>
  );
}

export function CategoryPage() {
  const { id } = useParams();
  const { catalogue, loading } = useShop();
  const category = catalogue.categories.find((c) => c.id === id);
  const products = useMemo(() => catalogue.products.filter((p) => p.categoryId === id), [catalogue.products, id]);
  const [list, controls] = useSorted(products);

  return (
    <div className="mx-auto max-w-[1280px] md:px-4 md:py-4">
      <div className="flex border-line bg-white md:rounded-2xl md:border">
        <aside className="no-scrollbar sticky top-[124px] h-[calc(100vh-124px)] w-[84px] shrink-0 overflow-y-auto border-r border-line md:top-20 md:h-[calc(100vh-80px)] md:w-56">
          {catalogue.categories.map((c) => (
            <NavLink key={c.id} to={`/category/${c.id}`} className={({ isActive }) => `relative flex flex-col items-center gap-1.5 border-b border-[#f3f3f3] px-2 py-3 text-center md:flex-row md:gap-3 md:px-4 md:text-left ${isActive ? 'bg-brand-soft after:absolute after:inset-y-0 after:right-0 after:w-1 after:rounded-l after:bg-brand' : 'hover:bg-[#fafafa]'}`}>
              {({ isActive }) => (
                <>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${isActive ? 'bg-white' : 'bg-[#f3f6fb]'}`}>
                    {c.imageUrl ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-extrabold text-brand">{c.name[0]}</span>}
                  </span>
                  <span className={`line-clamp-2 text-[11px] leading-tight md:text-sm ${isActive ? 'font-extrabold text-ink' : 'font-medium text-[#555]'}`}>{c.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </aside>
        <div className="min-w-0 flex-1 bg-canvas">
          <div className="sticky top-[124px] z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-3 py-3 md:top-20 md:px-5">
            <h1 className="text-base font-extrabold md:text-lg">Buy {category?.name ?? ''} Online <span className="text-sm font-medium text-muted">({products.length})</span></h1>
            {controls}
          </div>
          <div className="p-2.5 md:p-4">
            {loading ? <Skeleton /> : list.length ? <ProductGrid products={list} dense /> : <Empty title="No products here yet" text="Check back soon or browse other categories." />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { catalogue, loading } = useShop();
  const results = useMemo(() => searchProducts(catalogue.products, q), [catalogue.products, q]);
  const [list, controls] = useSorted(results);
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Crumbs items={[{ label: 'Search' }]} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Results for “{q}”</h1>
          <p className="mt-1 text-sm text-muted">{results.length} products found</p>
        </div>
        {controls}
      </div>
      {loading ? <Skeleton /> : list.length ? <ProductGrid products={list} /> : <Empty title="No result found" text="Try another product or category." />}
    </div>
  );
}

// "See all" for an admin-curated homepage section (same RPC the app pages through).
export function CollectionPage() {
  const { id } = useParams();
  const { productById } = useShop();
  const [section, setSection] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    supabase.rpc('get_homepage_sections', { p_section_id: id, p_offset: 0, p_limit: 100 }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(e.message); else setSection(data?.[0] ?? null);
    });
    return () => { alive = false; };
  }, [id]);
  const products = (section?.product_ids ?? []).map((pid) => productById.get(pid)).filter(Boolean);
  const [list, controls] = useSorted(products);
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6">
      <Crumbs items={[{ label: section?.title ?? 'Collection' }]} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {section?.top_text && <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">{section.top_text}</p>}
          <h1 className="title-underline mt-1 text-2xl font-extrabold uppercase md:text-3xl">{section?.title ?? '…'}</h1>
          {section?.subtitle && <p className="mt-3 text-sm text-muted">{section.subtitle}</p>}
        </div>
        {controls}
      </div>
      {error ? <p className="text-[#b91c1c]">{error}</p> : !section ? <Skeleton /> : list.length ? <ProductGrid products={list} /> : <Empty title="Nothing here right now" text="This collection is empty." />}
    </div>
  );
}
