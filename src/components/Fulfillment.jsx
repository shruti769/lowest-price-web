// Ports of the customer app's LivePickup + DeliverySlotPicker, using the same tables/RPCs.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Navigation, Phone, ShoppingBag, Wifi, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useShop } from '../store/ShopContext';
import { ProductShelf } from './Shelves';

const SG = 'Asia/Singapore';

function sgNowParts(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SG, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: SG, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { weekday: get('weekday'), time: `${get('hour')}:${get('minute')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), date: d };
}

function hubOpen(hub, now) {
  const { weekday, time } = sgNowParts(now);
  const day = hub.opening_hours?.find((d) => d.day === weekday);
  return !hub.temporarily_closed && !!day && !day.closed && (day.allDay || (day.open <= time && time < day.close));
}

function usePickupData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [h, s, p, f] = await Promise.all([
          supabase.from('pickup_locations').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('pickup_sections').select('*,pickup_section_products(product_id,sort_order)').eq('is_active', true).order('sort_order').order('id'),
          supabase.from('products').select('id').eq('is_active', true).eq('pickup', true),
          supabase.from('pickup_hub_flash_sales').select('hub_id,flash_sales!inner(id,name,starts_at,ends_at,flash_sale_products(product_id))'),
        ]);
        for (const r of [h, s, p, f]) if (r.error) throw r.error;
        if (alive) { setData({ hubs: h.data ?? [], sections: s.data ?? [], allowed: new Set((p.data ?? []).map((x) => x.id)), sales: f.data ?? [] }); setError(''); }
      } catch {
        if (alive) setError('Could not refresh pickup details. Please try again.');
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return { data, error };
}

export function PickupPicker({ showProducts = false }) {
  const { pickupSelection, setPickupSelection, productById } = useShop();
  const { data, error } = usePickupData();
  const [hubId, setHubId] = useState(pickupSelection?.hubId ?? '');
  const [now, setNow] = useState(() => new Date());
  const [usage, setUsage] = useState({});
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const hub = data?.hubs.find((h) => h.id === (pickupSelection?.hubId || hubId)) ?? data?.hubs[0];

  useEffect(() => {
    if (!hub) return;
    let alive = true;
    const load = async () => {
      const { data: rows, error: e } = await supabase.rpc('pickup_slot_usage', { p_hub_id: hub.id });
      if (alive && !e) setUsage(Object.fromEntries((rows ?? []).map((x) => [new Date(x.pickup_at).toISOString(), Number(x.booked)])));
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [hub]);

  useEffect(() => {
    if (data?.hubs.length === 1 && pickupSelection?.hubId !== data.hubs[0].id) {
      const h = data.hubs[0];
      setPickupSelection({ hubId: h.id, hubName: h.name, address: h.address, pickupAt: null, asap: false });
    }
  }, [data, pickupSelection?.hubId, setPickupSelection]);

  const { weekday, minutes, date } = sgNowParts(now);
  const slotISO = (time) => new Date(`${date}T${time}:00+08:00`).toISOString();
  const slots = useMemo(() => {
    if (!hub) return [];
    const hours = hub.opening_hours?.find((d) => d.day === weekday);
    return (hub.slots ?? []).filter((x) => x.day === weekday && x.capacity > 0
      && Number(x.time.slice(0, 2)) * 60 + Number(x.time.slice(3)) >= minutes + hub.ready_minutes
      && hours && !hours.closed && (hours.allDay || (x.time >= hours.open && x.time < hours.close)) && !hub.temporarily_closed);
  }, [hub, weekday, minutes]);

  if (!data) return <div className="card p-6 text-sm text-muted">{error || 'Loading pickup hubs…'}</div>;
  if (!hub) return <div className="card p-6 text-sm text-muted">No pickup locations available.</div>;

  const open = hubOpen(hub, now);
  const selectedSlot = pickupSelection?.hubId === hub.id ? (pickupSelection.asap ? 'ASAP' : pickupSelection.pickupAt) : '';
  const choose = (value) => setPickupSelection(value);

  const sections = data.sections.filter((x) => x.hub_id === hub.id && (!x.starts_at || new Date(x.starts_at) <= now) && (!x.ends_at || new Date(x.ends_at) > now));
  const sales = data.sales.filter((x) => x.hub_id === hub.id && new Date(x.flash_sales.starts_at) <= now && new Date(x.flash_sales.ends_at) > now);
  const toProducts = (ids) => ids.map((id) => productById.get(id)).filter((p) => p && data.allowed.has(p.id));

  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-brown">{hub.name}</h3>
            <span className={`rounded px-2 py-1 text-xs font-bold ${open ? 'bg-[#91f5a5] text-[#006c30]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>{open ? 'OPEN NOW' : 'CLOSED'}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Clock size={14} /> Ready in {hub.ready_minutes} min</p>
          {hub.address && <p className="mt-2 text-sm text-muted">{hub.address}</p>}
          <div className="mt-4 flex gap-3">
            <a href={hub.phone ? `tel:${hub.phone}` : undefined} className={`btn-ghost flex-1 py-2.5 ${!hub.phone ? 'pointer-events-none opacity-40' : ''}`}><Phone size={16} /> Call</a>
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hub.address)}`} className="btn-primary flex-1 py-2.5"><Navigation size={16} /> Directions</a>
          </div>
          {hub.features?.length > 0 && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {hub.features.map((f) => {
                const Icon = /wifi/i.test(f) ? Wifi : /24|hour/i.test(f) ? Clock : ShoppingBag;
                return <p key={f} className="flex items-center gap-2 text-sm text-brown"><Icon size={16} className="text-brand" /> <span className="flex-1">{f}</span> <CheckCircle2 size={14} className="text-[#008236]" /></p>;
              })}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="title-underline text-base font-extrabold uppercase">Pickup timing</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {open && hub.asap_enabled && (
              <button onClick={() => choose({ hubId: hub.id, hubName: hub.name, address: hub.address, pickupAt: null, asap: true })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedSlot === 'ASAP' ? 'border-brand bg-brand text-white' : 'border-line text-muted hover:border-brand'}`}>ASAP</button>
            )}
            {slots.map((x) => {
              const iso = slotISO(x.time);
              const full = (usage[iso] ?? 0) >= x.capacity;
              const on = selectedSlot === iso;
              return (
                <button key={x.time} disabled={full} onClick={() => choose({ hubId: hub.id, hubName: hub.name, address: hub.address, pickupAt: iso, asap: false })} className={`rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-40 ${on ? 'border-brand bg-brand text-white' : 'border-line text-muted hover:border-brand'}`}>
                  Today, {new Date(iso).toLocaleTimeString('en-SG', { timeZone: SG, hour: 'numeric', minute: '2-digit' })}{full ? ' · Full' : ''}
                </button>
              );
            })}
          </div>
          {!slots.length && !(open && hub.asap_enabled) && <p className="mt-3 text-sm text-muted">No pickup times available today.</p>}
          {data.hubs.length > 1 && (
            <>
              <h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-muted">Other hubs</h4>
              <div className="mt-2 space-y-2">
                {data.hubs.filter((h) => h.id !== hub.id).map((h) => (
                  <button key={h.id} onClick={() => { setHubId(h.id); choose(null); }} className="flex w-full items-center justify-between rounded-xl border border-[#d9e6ff] p-3 text-left hover:border-brand">
                    <span><span className="block text-sm font-semibold text-brown">{h.name}</span><span className="text-xs text-muted">{h.address}</span></span>
                    <span className={`text-[10px] font-bold ${hubOpen(h, now) ? 'text-[#006c30]' : 'text-[#b91c1c]'}`}>{hubOpen(h, now) ? 'OPEN' : 'CLOSED'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {sales.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#ff3b30] p-4 text-white">
          <Zap /> <div><p className="font-bold">{sales[0].flash_sales.name}</p><p className="text-sm opacity-90">Ends {new Date(sales[0].flash_sales.ends_at).toLocaleString('en-SG', { timeZone: SG })}</p></div>
        </div>
      )}
      {showProducts && sections.map((s) => (
        <ProductShelf key={s.id} eyebrow="At this hub" title={s.title} products={toProducts([...s.pickup_section_products].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.product_id))} />
      ))}
      {showProducts && sales.map((s) => (
        <ProductShelf key={s.flash_sales.id} eyebrow="Hub flash sale" title={s.flash_sales.name} products={toProducts(s.flash_sales.flash_sale_products.map((p) => p.product_id))} />
      ))}
    </div>
  );
}

const fee = (v) => (Number(v ?? 0) === 0 ? 'FREE' : `S$${Number(v).toFixed(2)}`);
const slotTime = (slot) => `${slot.label.split(' · ').slice(1).join(' · ')} SGT`;
const sgDate = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: SG }).format(new Date(Date.now() + offset * 86400000));

function Option({ checked, disabled, title, subtitle, price, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`mb-2.5 flex w-full items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-50 ${checked ? 'border-brand bg-brand-soft/50' : 'border-[#ddd] hover:border-brand'}`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? 'border-brand' : 'border-[#bbb]'}`}>{checked && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>
      <span className="flex-1"><span className="block font-bold">{title}</span><span className="text-sm text-muted">{subtitle}</span></span>
      {price && <span className={`font-bold ${price === 'FREE' ? 'text-brand' : ''}`}>{price}</span>}
    </button>
  );
}

export function DeliverySlotPicker({ value, onChange, onSelectionChange }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pickedMode, setMode] = useState('');
  const [pickedDay, setDay] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data, error: e } = await supabase.rpc('available_delivery_slots');
        if (e) throw e;
        if (alive) { setSlots(data ?? []); setError(''); }
      } catch { if (alive) setError('Could not load delivery times. Click to retry.'); }
      finally { if (alive) setLoading(false); }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [retry]);

  useEffect(() => { if (!loading && !error && value && !slots.some((s) => s.id === value)) onChange(''); }, [slots, value, onChange, loading, error]);
  const selected = slots.find((s) => s.id === value);
  useEffect(() => { onSelectionChange?.(selected ?? null); }, [selected, onSelectionChange]);

  const mode = selected?.kind ?? pickedMode;
  const day = selected?.kind === 'scheduled' ? selected.date : pickedDay;
  const express = slots.find((s) => s.kind === 'express');
  const scheduled = slots.filter((s) => s.kind === 'scheduled');
  const days = [{ date: sgDate(), name: 'Today' }, { date: sgDate(1), name: 'Tomorrow' }].map((d) => ({ ...d, slots: scheduled.filter((s) => s.date === d.date) }));
  const activeDay = days.find((d) => d.date === day) ?? days.find((d) => d.slots.length) ?? days[0];
  const clear = () => { setMode(''); setDay(''); onChange(''); };
  const scheduledPrice = selected?.kind === 'scheduled' ? fee(selected.fee) : scheduled.length && scheduled.every((s) => fee(s.fee) === 'FREE') ? 'FREE' : undefined;

  return (
    <div>
      <h3 className="mb-3 text-base font-bold">Delivery time</h3>
      {loading && <p className="text-sm text-muted">Loading delivery times…</p>}
      {error && <button onClick={() => setRetry((n) => n + 1)} className="text-sm text-[#b42318]">{error}</button>}
      {!loading && !error && !slots.length && <p className="text-sm">No delivery slots available. Please check again later.</p>}
      {!loading && !error && slots.length > 0 && (
        <>
          <Option checked={mode === 'express' && !!express} disabled={!express} title="Express delivery"
            subtitle={express ? `${express.date === days[0].date ? 'Today' : 'Tomorrow'} · ${slotTime(express)}` : 'Not available right now'}
            price={express && fee(express.fee)}
            onClick={() => { if (mode === 'express') clear(); else if (express) { setMode('express'); onChange(express.id); } }} />
          <Option checked={mode === 'scheduled'} disabled={!scheduled.length} title="Scheduled delivery"
            subtitle={scheduled.length ? 'Pick a time today or tomorrow' : 'No time slots available'} price={scheduledPrice}
            onClick={() => { if (mode === 'scheduled') clear(); else { setMode('scheduled'); setDay(activeDay.date); onChange(''); } }} />
          {mode === 'scheduled' && (
            <div className="rounded-xl border border-line p-3">
              <div className="mb-3 flex gap-2">
                {days.map((d) => {
                  const on = d.date === activeDay.date;
                  return (
                    <button type="button" key={d.date} disabled={!d.slots.length} onClick={() => { setDay(d.date); if (selected?.date !== d.date) onChange(''); }} className={`flex-1 rounded-xl py-2.5 text-center disabled:opacity-50 ${on ? 'bg-brand text-white' : 'bg-[#f2f4f7] text-[#333]'}`}>
                      <span className="block font-bold">{d.name}</span>
                      <span className="text-xs opacity-80">{d.slots.length ? `${d.slots.length} slot${d.slots.length > 1 ? 's' : ''}` : 'No slots'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeDay.slots.map((s) => {
                  const on = value === s.id;
                  return (
                    <button type="button" key={s.id} onClick={() => { setDay(s.date); onChange(on ? '' : s.id); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${on ? 'border-brand bg-brand-soft/50' : 'border-[#ddd] hover:border-brand'}`}>
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${on ? 'border-brand' : 'border-[#bbb]'}`}>{on && <span className="h-2 w-2 rounded-full bg-brand" />}</span>
                      <span className="flex-1 text-sm font-semibold">{slotTime(s)}{s.remaining <= 5 && <span className="block text-xs font-normal text-[#b54708]">Only {s.remaining} left</span>}</span>
                      <span className={`text-sm font-bold ${fee(s.fee) === 'FREE' ? 'text-brand' : ''}`}>{fee(s.fee)}</span>
                    </button>
                  );
                })}
              </div>
              {!activeDay.slots.length && <p className="text-sm text-muted">No time slots for this day.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
