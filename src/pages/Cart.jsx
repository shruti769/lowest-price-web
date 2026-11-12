import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import CartPanel from '../components/CartPanel';
import { voucherEligibility } from '../lib/catalogue';
import { sgd } from '../lib/format';

export function VoucherBox() {
  const { vouchers, voucherCode, setVoucherCode, totals, notify } = useShop();
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const applied = vouchers.find((v) => v.code === voucherCode);
  const state = applied ? voucherEligibility(applied, totals.subtotal) : null;
  const apply = (code) => {
    const clean = code.trim().toUpperCase();
    const v = vouchers.find((x) => x.code === clean);
    if (!v) return notify('Voucher is no longer available.');
    const s = voucherEligibility(v, totals.subtotal);
    if (!s.eligible) return notify(s.label);
    setVoucherCode(clean); setInput(''); setOpen(false); notify(`${clean} applied`);
  };
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold"><Tag size={18} className="text-brand" /> Vouchers</p>
        {vouchers.length > 0 && <button onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-brand">{open ? 'Hide' : `View ${vouchers.length} available`}</button>}
      </div>
      {voucherCode ? (
        <div className={`mt-3 flex items-center justify-between rounded-xl border border-dashed p-3 ${state?.eligible ? 'border-price bg-[#effaf3]' : 'border-[#f59e0b] bg-[#fffbeb]'}`}>
          <div>
            <p className="font-extrabold tracking-wide">{voucherCode}</p>
            <p className="text-xs text-muted">{state?.eligible ? 'Applied to your order' : state?.label ?? 'This voucher is no longer available.'}</p>
          </div>
          <button onClick={() => setVoucherCode('')} aria-label="Remove voucher" className="p-1 text-muted hover:text-ink"><X size={18} /></button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) apply(input); }} className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter voucher code" className="input py-2.5 uppercase" />
          <button className="btn-primary px-4 py-2.5">Apply</button>
        </form>
      )}
      {open && (
        <div className="mt-3 space-y-2">
          {vouchers.map((v) => {
            const s = voucherEligibility(v, totals.subtotal);
            return (
              <div key={v.code} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="flex-1">
                  <p className="font-extrabold">{v.discountType === 'percentage' ? `${v.value}% OFF` : `${sgd(v.value)} OFF`}{v.maxDiscount !== undefined && v.discountType === 'percentage' ? ` · up to ${sgd(v.maxDiscount)}` : ''}</p>
                  <p className="text-xs text-muted">Code {v.code} · Min order {sgd(v.minOrder)}{v.expiresAt ? ` · Ends ${new Date(v.expiresAt).toLocaleDateString('en-SG')}` : ''}</p>
                </div>
                <button disabled={!s.eligible || v.code === voucherCode} onClick={() => apply(v.code)} className="rounded-lg border border-brand px-3 py-1.5 text-xs font-bold text-brand disabled:border-line disabled:text-muted">{v.code === voucherCode ? 'Applied' : s.label}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Cart() {
  return (
    <div className="mx-auto h-[calc(100vh-80px)] max-w-xl md:my-6 md:h-[80vh] md:overflow-hidden md:rounded-2xl md:border md:border-line">
      <CartPanel />
    </div>
  );
}
