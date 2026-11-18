import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, CircleDashed, ClipboardList, Loader2, PackageCheck, RotateCcw, XCircle } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { supabase } from '../lib/supabase';
import { cancelRetailOrder, fetchMyOrders, fetchRetailOrder } from '../lib/account';
import { formatDate, sgd } from '../lib/format';

const BADGE = {
  ACTIVE: 'bg-brand-soft text-brand',
  DELIVERED: 'bg-[#effaf3] text-price',
  CANCELLED: 'bg-[#fef2f2] text-[#b91c1c]',
};

export function OrdersPage() {
  const { user, authReady, addToCart, productById, notify } = useShop();
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState('ALL');
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => fetchMyOrders(user.id).then((o) => alive && setOrders(o)).catch(() => alive && setOrders([]));
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  if (!authReady) return null;
  if (!user) return <Navigate to="/login?next=/orders" replace />;

  const reorder = (items) => {
    let added = 0;
    for (const i of items ?? []) { const p = productById.get(i.id); if (p && !i.wholesale) { addToCart(p, i.quantity); added++; } }
    notify(added ? 'Items added to your cart' : 'These items are no longer available');
  };
  const visible = (orders ?? []).filter((o) => tab === 'ALL' || o.status === tab);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold md:text-3xl">My orders</h1>
      <div className="mt-5 flex gap-2">
        {[['ALL', 'All'], ['ACTIVE', 'Active'], ['DELIVERED', 'Completed'], ['CANCELLED', 'Cancelled']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === k ? 'bg-ink text-white' : 'bg-[#f2f4f7] text-muted'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {orders === null ? <p className="flex items-center gap-2 text-muted"><Loader2 className="animate-spin" size={18} /> Loading orders…</p>
          : !visible.length ? (
            <div className="py-16 text-center">
              <ClipboardList className="mx-auto text-[#bbb]" size={48} />
              <p className="mt-4 text-lg font-bold">No orders yet</p>
              <Link to="/" className="btn-primary mt-6">Start shopping</Link>
            </div>
          ) : visible.map((o) => (
            <div key={o.key} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-extrabold">{o.id ?? o.key}</p>
                  <p className="text-xs text-muted">{formatDate(o.placedAt)} · {o.fulfillmentMode === 'STORE_PICKUP' ? 'Store pickup' : o.kind === 'wholesale' ? 'Wholesale' : 'Delivery'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${BADGE[o.status]}`}>{o.status === 'DELIVERED' ? 'COMPLETED' : o.status}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {(o.items ?? []).slice(0, 5).map((i, n) => <img key={n} src={i.image} alt={i.name} title={i.name} className="h-12 w-12 rounded-lg border border-line object-cover" />)}
                {(o.items?.length ?? 0) > 5 && <span className="text-sm font-bold text-muted">+{o.items.length - 5}</span>}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-sm text-muted">{o.itemCount ?? o.items?.length} items · <b className="text-ink">{sgd(o.total)}</b></p>
                <div className="flex gap-2">
                  <button onClick={() => reorder(o.items)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-bold hover:border-brand hover:text-brand"><RotateCcw size={15} /> Reorder</button>
                  {o.retailOrderId && <Link to={`/orders/${o.retailOrderId}`} className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">Track <ChevronRight size={15} /></Link>}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const STATUS_COPY = {
  PENDING: 'Awaiting payment confirmation',
  PAID: 'Payment confirmed · preparing order',
  COMPLETED: 'Order completed',
  CANCELLED: 'Order cancelled',
  REFUNDED: 'Order refunded',
};

// Rider progress, mirrored onto the order by the backend when a rider is dispatched.
const RIDER_COPY = {
  FINDING_RIDER: '🛵 Finding a rider for your order',
  RIDER_ASSIGNED: '🛵 Rider assigned',
  OUT_FOR_DELIVERY: '🛵 Out for delivery',
  RIDER_ARRIVED: '📍 Rider has arrived',
  DELIVERED: '✅ Delivered',
};

export function OrderDetail() {
  const { id } = useParams();
  const { user, authReady, refreshWallet } = useShop();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => fetchRetailOrder(id).then((o) => { setOrder(o); setError(''); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    if (!user) return;
    refresh();
    const t = setInterval(refresh, 15000);
    const ch = supabase.channel(`web-retail:${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'retail_orders', filter: `id=eq.${id}` }, refresh).subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [id, user, refresh]);

  if (!authReady) return null;
  if (!user) return <Navigate to={`/login?next=/orders/${id}`} replace />;

  const cancel = async () => {
    if (!window.confirm('Cancel this order? Reserved points and voucher availability will be released.')) return;
    setBusy(true);
    try { await cancelRetailOrder(id); await refresh(); refreshWallet(); } catch (e) { setError(e.message || 'Could not cancel'); } finally { setBusy(false); }
  };

  const snap = order?.order_snapshot;
  const steps = ['PENDING', 'PAID', 'COMPLETED'];
  const idx = order ? steps.indexOf(order.status) : -1;
  const cancelled = order && ['CANCELLED', 'REFUNDED'].includes(order.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/orders" className="flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft size={16} /> Orders</Link>
      <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">Order status</h1>
      <p className="mt-1 select-all text-xs text-muted">{snap?.id ? `${snap.id} · ` : ''}{id}</p>
      {error && <button onClick={refresh} className="mt-4 text-sm text-[#b91c1c]">{error} · Retry</button>}
      {!order ? <p className="mt-8 flex items-center gap-2 text-muted"><Loader2 className="animate-spin" size={18} /> Loading…</p> : (
        <>
          <div className="card mt-6 p-6">
            <p className={`text-xl font-extrabold ${cancelled ? 'text-[#b91c1c]' : ''}`}>{STATUS_COPY[order.status] ?? order.status}</p>
            {!cancelled && (
              <div className="mt-6 flex items-center">
                {['Placed', 'Confirmed', 'Completed'].map((label, i) => (
                  <div key={label} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      {i <= idx ? <CheckCircle2 className="text-price" size={28} /> : <CircleDashed className="text-[#ccc]" size={28} />}
                      <span className={`text-xs font-bold ${i <= idx ? 'text-ink' : 'text-muted'}`}>{label}</span>
                    </div>
                    {i < 2 && <span className={`mx-2 mb-5 h-0.5 flex-1 ${i < idx ? 'bg-price' : 'bg-line'}`} />}
                  </div>
                ))}
              </div>
            )}
            {cancelled && <XCircle className="mt-4 text-[#b91c1c]" size={32} />}
            {!cancelled && RIDER_COPY[snap?.deliveryStatus] && (
              <p className="mt-6 rounded-xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-dark">
                {RIDER_COPY[snap.deliveryStatus]}{snap.riderName && snap.deliveryStatus !== 'FINDING_RIDER' ? ` · ${snap.riderName}` : ''}
              </p>
            )}
            {snap?.deliverySlot && <p className="mt-6 text-sm"><b>Delivery:</b> {snap.deliverySlot} SGT</p>}
            {snap?.deliveryAddress && <p className="mt-1 text-sm"><b>Address:</b> {snap.deliveryAddress}</p>}
            {snap?.pickup?.hubName && <p className="mt-1 text-sm"><b>Pickup:</b> {snap.pickup.hubName}</p>}
          </div>
          <div className="card mt-4 divide-y divide-line">
            {(snap?.items ?? []).map((i, n) => (
              <div key={n} className="flex items-center gap-3 p-4">
                {i.image && <img src={i.image} alt="" className="h-12 w-12 rounded-lg border border-line object-cover" />}
                <p className="flex-1 text-sm">{i.quantity} × {i.name}</p>
                {i.price != null && <p className="text-sm font-bold">{sgd(Number(String(i.price).replace(/[^0-9.]/g, '')) * i.quantity)}</p>}
              </div>
            ))}
            <div className="flex justify-between p-4 text-lg font-extrabold"><span>Total</span><span>{sgd(snap?.total)}</span></div>
          </div>
          <div className="card mt-4 flex gap-6 p-5 text-sm">
            <p className="flex items-center gap-2"><PackageCheck size={18} className="text-brand" /> Points redeemed: <b>{order.redeemed_points}</b></p>
            <p>Points earned: <b>{order.earned_points}</b></p>
          </div>
          {order.status === 'PENDING' && (
            <div className="mt-4 rounded-2xl bg-[#fffbeb] p-5 text-sm">
              <p className="text-muted">Reservation expires {new Date(order.expires_at).toLocaleString('en-SG')}. Points are earned after payment and completion.</p>
              <button disabled={busy} onClick={cancel} className="mt-3 font-bold text-[#b91c1c]">{busy ? 'Cancelling…' : 'Cancel order'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
