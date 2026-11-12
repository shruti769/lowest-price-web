import { Info } from 'lucide-react';
import { sgd } from '../lib/format';
import { voucherDiscount } from '../lib/catalogue';

function Row({ label, value, green, total, hint }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${total ? 'pt-1 text-lg font-extrabold' : 'text-sm'}`}>
      <span className={`flex items-center gap-1 ${total ? '' : 'text-muted'}`}>{label}{hint && <span title={hint}><Info size={13} /></span>}</span>
      <span className={green ? 'font-bold text-price' : total ? '' : 'font-semibold'}>{value}</span>
    </div>
  );
}

// Mirrors the app's OrderSummary. When a server quote is present its discounts/total win.
export default function Summary({ totals, pickup, voucher, quote, tip = 0, deliveryFeeOverride }) {
  const deliveryFee = pickup ? 0 : quote?.deliveryFee ?? deliveryFeeOverride ?? totals.deliveryFee;
  const vDiscount = quote ? quote.voucherDiscount : voucherDiscount(voucher, totals.subtotal);
  const lDiscount = quote?.loyaltyDiscount ?? 0;
  const bDiscount = quote?.bundleDiscount ?? 0;
  const local = Math.max(0, totals.subtotal + totals.smallOrderFee + totals.platformFee + deliveryFee - vDiscount - lDiscount - bDiscount) + totals.bcrsDeposit + (pickup ? 0 : tip);
  const total = quote?.total ?? local;
  return (
    <div className="space-y-2.5">
      <Row label={`Basket total (${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'})`} value={sgd(totals.subtotal)} />
      {bDiscount > 0 && <Row green label="Bundle offer" value={`-${sgd(bDiscount)}`} />}
      {vDiscount > 0 && <Row green label="Voucher discount" value={`-${sgd(vDiscount)}`} />}
      {lDiscount > 0 && <Row green label="Loyalty discount" value={`-${sgd(lDiscount)}`} />}
      <Row green label={pickup ? 'Store pickup' : 'Delivery fee'} value={pickup || deliveryFee === 0 ? 'FREE' : sgd(deliveryFee)} />
      {!pickup && totals.smallOrderFee > 0 && <Row label="Small order fee" hint="Applies to delivery orders below the minimum order value" value={sgd(totals.smallOrderFee)} />}
      {totals.bcrsDeposit > 0 && <Row label="Total BCRS Deposit" hint="Refundable beverage container deposit" value={sgd(totals.bcrsDeposit)} />}
      {!pickup && totals.platformFee > 0 && <Row label="Platform fee" value={sgd(totals.platformFee)} />}
      {!pickup && tip > 0 && <Row label="Rider tip" value={sgd(tip)} />}
      <div className="border-t border-dashed border-line pt-2.5"><Row total label="Total to pay" value={sgd(total)} /></div>
      {quote?.pointsToEarn > 0 && <p className="text-right text-xs font-semibold text-price">You’ll earn {quote.pointsToEarn} loyalty points</p>}
    </div>
  );
}
