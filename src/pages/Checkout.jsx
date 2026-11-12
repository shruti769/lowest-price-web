import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Banknote, Check, CheckCircle2, Crown, HandHeart, Home as HomeIcon, Leaf, Loader2, QrCode, Store } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { bookOrder, quoteRetail } from '../lib/account';
import { fetchActiveVouchers, voucherEligibility } from '../lib/catalogue';
import { DeliverySlotPicker, PickupPicker } from '../components/Fulfillment';
import Summary from '../components/Summary';
import { readJSON, sgd, writeJSON } from '../lib/format';

function Steps({ current }) {
  const steps = ['Details', 'Payment', 'Done'];
  return (
    <div className="mb-8 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i <= current ? 'bg-brand text-white' : 'bg-[#f2f4f7] text-muted'}`}>{i < current ? <Check size={16} /> : i + 1}</span>
          <span className={`text-sm font-bold ${i <= current ? 'text-ink' : 'text-muted'}`}>{s}</span>
          {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < current ? 'bg-brand' : 'bg-line'}`} />}
        </div>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-[#009900]' : 'bg-[#ddd]'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function Success({ order }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto flex h-24 w-24 animate-rise items-center justify-center rounded-full bg-[#effaf3]"><CheckCircle2 size={56} className="text-price" /></div>
      <h1 className="mt-6 text-3xl font-extrabold">Order placed!</h1>
      <p className="mt-2 text-muted">Thank you for shopping with Lowest Price SG Mart. Your order is pending until the store confirms payment.</p>
      <div className="card mt-8 p-5 text-left">
        <div className="flex justify-between text-sm"><span className="text-muted">Order</span><span className="font-bold">{order.ref}</span></div>
        <div className="mt-2 flex justify-between text-sm"><span className="text-muted">Items</span><span className="font-bold">{order.itemCount}</span></div>
        <div className="mt-2 flex justify-between text-sm"><span className="text-muted">Payment</span><span className="font-bold">{order.paidWith}</span></div>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-extrabold"><span>Total</span><span>{sgd(order.total)}</span></div>
        {order.pointsToEarn > 0 && <p className="mt-2 text-sm font-semibold text-price">You’ll earn {order.pointsToEarn} points once your order is completed.</p>}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {order.retailOrderId && <Link to={`/orders/${order.retailOrderId}`} className="btn-primary">Track order <ArrowRight size={18} /></Link>}
        <Link to="/" className="btn-ghost">Continue shopping</Link>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { user, authReady, cart, totals, mode, setMode, pickupSelection, vouchers, setVouchers, voucherCode, setVoucherCode, wallet, refreshWallet, clearCart, notify } = useShop();
  const pickup = mode === 'STORE_PICKUP';
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(() => readJSON('lpsg:checkout-details', { line1: '', line2: '', deliveryInstructions: '', deliverySlot: '' }));
  useEffect(() => { writeJSON('lpsg:checkout-details', details); }, [details]);
  const [slot, setSlot] = useState(null);
  const [plasticFree, setPlasticFree] = useState(true);
  const [tipInput, setTipInput] = useState('');
  const tip = pickup ? 0 : Math.min(999, Number(tipInput) || 0);
  const [payment, setPayment] = useState('PayNow QR');
  const [points, setPoints] = useState(0);
  const [quote, setQuote] = useState(null);
  const [maxPoints, setMaxPoints] = useState(0);
  const [quoteError, setQuoteError] = useState('');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [placed, setPlaced] = useState(null);
  const placingRef = useRef(false);

  const voucher = vouchers.find((v) => v.code === voucherCode);
  const eligibleVoucher = voucher && voucherEligibility(voucher, totals.subtotal).eligible ? voucher : undefined;
  const slotId = pickup ? '' : details.deliverySlot;
  const setSlotId = useCallback((id) => setDetails((d) => (d.deliverySlot === id ? d : { ...d, deliverySlot: id })), []);

  // Server-verified total (same RPC as the app). Debounced.
  const quoteKey = JSON.stringify([cart.map((l) => [l.id, l.quantity]), pickup, slotId, eligibleVoucher?.code ?? '', points, tip]);
  useEffect(() => {
    if (!user || !cart.length || placed) return;
    let alive = true;
    const t = setTimeout(async () => {
      setQuoteBusy(true);
      try {
        const q = await quoteRetail(cart, pickup, eligibleVoucher?.code ?? '', points, tip, slotId);
        if (!alive) return;
        setQuote({ ...q, key: quoteKey }); setQuoteError('');
        if (!points) setMaxPoints(q.maxRedeemPoints ?? 0);
      } catch (e) {
        if (!alive) return;
        if (points > 0) { setPoints(0); notify('Points selection removed because the rules or balance changed.'); return; }
        setQuote(null); setQuoteError(e?.message || 'Could not verify checkout');
      } finally { if (alive) setQuoteBusy(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, user, placed]);
  const verified = quote?.key === quoteKey ? quote : null;

  const address = [details.line1, details.line2].filter(Boolean).join(', ');
  const detailsError = pickup
    ? (!pickupSelection ? 'Choose a pickup hub and time.' : !pickupSelection.asap && !pickupSelection.pickupAt ? 'Choose a pickup time.' : '')
    : (!details.line1.trim() ? 'Enter your delivery address.' : !details.line2.trim() ? 'Enter your unit number and postal code.' : !slotId ? 'Select a delivery slot.' : '');

  const total = useMemo(() => verified?.total ?? null, [verified]);

  if (!authReady) return null;
  if (!user) return <Navigate to="/login?next=/checkout" replace />;
  if (placed) return <Success order={placed} />;
  if (!cart.length) return <Navigate to="/cart" replace />;

  const placeOrder = async () => {
    if (placingRef.current) return;
    placingRef.current = true; setPlacing(true); setPlaceError('');
    try {
      if (detailsError) throw new Error(detailsError);
      if (quoteBusy || quoteError || !verified) throw new Error(quoteError || 'Wait for checkout verification.');
      if (eligibleVoucher) {
        const fresh = await fetchActiveVouchers(); setVouchers(fresh);
        const v = fresh.find((x) => x.code === eligibleVoucher.code);
        if (!v || !voucherEligibility(v, totals.subtotal).eligible) throw new Error('This voucher is no longer eligible. Review or remove it in your cart.');
      }
      const signature = JSON.stringify({ items: cart.map(({ id, quantity }) => ({ id, quantity })), mode, pickupSelection, voucher: eligibleVoucher?.code ?? '', points, tip, details, payment });
      const pendingKey = `lpsg:retail-pending:${user.id}`;
      const pending = readJSON(pendingKey, null);
      const requestKey = pending?.signature === signature ? pending.key : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      writeJSON(pendingKey, { signature, key: requestKey });
      const seq = (Number(readJSON('lpsg:order-seq', 0)) % 999) + 1;
      writeJSON('lpsg:order-seq', seq);
      const order = {
        riderTip: tip,
        plasticFreeDelivery: pickup ? undefined : plasticFree,
        fulfillmentMode: pickup ? 'STORE_PICKUP' : 'ONLINE_DELIVERY',
        id: `LM-${String(seq).padStart(3, '0')}${pickup ? 'T' : ''}`,
        itemCount: totals.itemCount,
        items: cart,
        paidWith: payment.replace(' QR', ''),
        placedAt: new Date().toISOString(),
        status: 'ACTIVE',
        total: verified.total,
        source: 'web',
        ...(pickup ? {} : { deliveryAddress: address, deliverySlot: slotId, deliveryInstructions: details.deliveryInstructions }),
      };
      const booking = await bookOrder({ requestKey, order, voucher: eligibleVoucher?.code ?? '', points, pickup: pickup ? pickupSelection : null });
      if (booking?.status === 'CANCELLED') { localStorage.removeItem(pendingKey); throw new Error('Reservation expired. Review checkout and try again.'); }
      writeJSON(pendingKey, { completed: true });
      setPlaced({ ref: order.id, retailOrderId: booking?.id, itemCount: totals.itemCount, paidWith: pickup && payment !== 'PayNow QR' ? 'Pay at pickup' : payment, total: verified.total, pointsToEarn: verified.pointsToEarn });
      clearCart(); setVoucherCode(''); setPoints(0); refreshWallet();
      window.scrollTo(0, 0);
    } catch (e) {
      setPlaceError(e?.message || 'Could not place order. Please try again.');
    } finally {
      placingRef.current = false; setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold md:text-3xl">Checkout</h1>
      <Steps current={step} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[['ONLINE_DELIVERY', 'Delivery', HomeIcon], ['STORE_PICKUP', 'Store pickup', Store]].map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setMode(key)} className={`flex items-center justify-center gap-2 rounded-2xl border p-4 font-bold transition ${mode === key ? 'border-brand bg-brand-soft/60 text-brand' : 'border-line hover:border-brand'}`}><Icon size={18} /> {label}</button>
                ))}
              </div>

              {pickup ? (
                <PickupPicker />
              ) : (
                <>
                  <div className="card border-blush-line bg-blush/50 p-5">
                    <span className="rounded bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white">HOME</span>
                    <div className="mt-3 grid gap-3">
                      <input value={details.line1} onChange={(e) => setDetails({ ...details, line1: e.target.value })} placeholder="Address line (block, street)" className="input bg-white" />
                      <input value={details.line2} onChange={(e) => setDetails({ ...details, line2: e.target.value })} placeholder="Unit and postal code" className="input bg-white" />
                      <textarea value={details.deliveryInstructions} onChange={(e) => setDetails({ ...details, deliveryInstructions: e.target.value })} rows={2} placeholder="Delivery instructions (optional): leave at door, ring bell…" className="input resize-none bg-white" />
                    </div>
                  </div>
                  <div className="card p-5"><DeliverySlotPicker value={slotId} onChange={setSlotId} onSelectionChange={setSlot} /></div>
                  <div className="card divide-y divide-line">
                    <div className="flex items-center gap-3 p-5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#effaf3]"><Leaf size={18} className="text-[#00813e]" /></span>
                      <div className="flex-1"><p className="font-bold">Plastic-free delivery</p><p className="text-sm text-muted">Use recycled paper bags</p></div>
                      <Toggle on={plasticFree} onChange={setPlasticFree} label="Plastic-free delivery" />
                    </div>
                    <div className="flex items-center gap-3 p-5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft"><HandHeart size={18} className="text-brand" /></span>
                      <div className="flex-1"><p className="font-bold">Tip the rider</p><p className="text-sm text-muted">100% goes to the delivery partner</p></div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((n) => (
                          <button key={n} onClick={() => setTipInput(n ? String(n) : '')} className={`h-9 min-w-11 rounded-lg border px-2 text-sm font-bold ${tip === n ? 'border-brand bg-brand text-white' : 'border-line'}`}>{n ? `S$${n}` : 'None'}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {detailsError && <p className="text-sm font-semibold text-[#b54708]">{detailsError}</p>}
              <button disabled={!!detailsError} onClick={() => { setStep(1); window.scrollTo(0, 0); }} className="btn-primary w-full py-3.5 text-base">Continue to payment <ArrowRight size={18} /></button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{pickup ? 'Pickup' : 'Deliver to'}</p>
                  <button onClick={() => setStep(0)} className="text-sm font-bold text-brand">Change</button>
                </div>
                <p className="mt-2 font-semibold">{pickup ? `${pickupSelection?.hubName} · ${pickupSelection?.asap ? 'ASAP' : new Date(pickupSelection?.pickupAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}` : address}</p>
                {!pickup && slot && <p className="mt-1 text-sm text-muted">{slot.label} SGT</p>}
              </div>
              <div className="card p-5">
                <h3 className="text-lg font-extrabold">Payment method</h3>
                <p className="mt-1 text-sm text-muted">Your order remains pending until the store confirms payment. Points are earned only after payment and fulfilment.</p>
                <div className="mt-4 space-y-3">
                  {[['PayNow QR', QrCode, 'Pay using the store’s verified PayNow details. Confirmation is required.'], ['Cash on delivery', Banknote, pickup ? 'Pay when collecting your order.' : 'Pay when your order is delivered.']].map(([m, Icon, sub]) => (
                    <button key={m} onClick={() => setPayment(m)} className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${payment === m ? 'border-brand bg-brand-soft/50' : 'border-[#ddd] hover:border-brand'}`}>
                      <Icon className={payment === m ? 'text-brand' : 'text-muted'} />
                      <span className="flex-1"><span className="block font-bold">{m === 'Cash on delivery' && pickup ? 'Pay at pickup' : m}</span><span className="text-sm text-muted">{sub}</span></span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${payment === m ? 'border-brand' : 'border-[#bbb]'}`}>{payment === m && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff7e0]"><Crown className="text-[#e6a000]" /></span>
                <div className="flex-1">
                  <p className="font-bold">Loyalty points · {wallet?.balance ?? 0} available</p>
                  <p className="text-sm text-muted">{points ? `${points} points selected · ${sgd(verified?.loyaltyDiscount ?? 0)} off` : maxPoints ? `Redeem up to ${maxPoints} points on this order` : 'No points available to redeem'}</p>
                </div>
                <button disabled={quoteBusy || (!points && !maxPoints)} onClick={() => setPoints(points ? 0 : maxPoints)} className="rounded-lg border border-brand px-3 py-2 text-sm font-bold text-brand disabled:border-line disabled:text-muted">{points ? 'Remove' : 'Redeem'}</button>
              </div>
              {placeError && <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 text-sm font-semibold text-[#991b1b]">{placeError}</div>}
              <button disabled={placing || quoteBusy || !verified} onClick={placeOrder} className="btn-primary w-full py-4 text-base">
                {placing ? <><Loader2 className="animate-spin" size={18} /> Placing order…</> : <>Place order{total != null ? ` · ${sgd(total)}` : ''}</>}
              </button>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-44 lg:self-start">
          <div className="card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Order summary</p>
            <div className="mb-4 max-h-56 space-y-3 overflow-y-auto pr-1">
              {cart.map((l) => (
                <div key={l.id} className="flex items-center gap-3">
                  <img src={l.image} alt="" className="h-12 w-12 rounded-lg border border-line object-cover" />
                  <p className="line-clamp-2 flex-1 text-sm">{l.quantity} × {l.name}</p>
                  <p className="text-sm font-bold">{sgd(l.price * l.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-4">
              <Summary totals={totals} pickup={pickup} voucher={eligibleVoucher} quote={verified} tip={tip} deliveryFeeOverride={slot?.fee} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              {quoteBusy ? <><Loader2 size={13} className="animate-spin" /> Verifying total with the store…</> : verified ? <><CheckCircle2 size={13} className="text-price" /> Total verified</> : quoteError ? <span className="text-[#b91c1c]">{quoteError}</span> : 'Total will be verified before you pay'}
            </p>
            {voucherCode && !eligibleVoucher && <p className="mt-2 text-xs text-[#b54708]">Voucher {voucherCode} isn’t applied: {voucher ? voucherEligibility(voucher, totals.subtotal).label : 'no longer available'}.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
