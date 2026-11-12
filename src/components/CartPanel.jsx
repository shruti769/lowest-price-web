import { useNavigate, Link } from 'react-router-dom';
import { Bike, ChevronRight, FileText, ShoppingBag, Store, Timer, X } from 'lucide-react';
import { useShop } from '../store/ShopContext';
import { voucherDiscount, voucherEligibility } from '../lib/catalogue';
import { VoucherBox } from '../pages/Cart';
import { QuantityControl } from './ProductCard';
import Summary from './Summary';
import { sgd } from '../lib/format';

// Quick-commerce style cart: grey canvas, white cards, sticky green proceed bar.
export default function CartPanel({ onClose }) {
  const { cart, totals, mode, setMode, settings, vouchers, voucherCode, user, pickupSelection } = useShop();
  const navigate = useNavigate();
  const pickup = mode === 'STORE_PICKUP';
  const voucher = vouchers.find((v) => v.code === voucherCode);
  const eligibleVoucher = voucher && voucherEligibility(voucher, totals.subtotal).eligible ? voucher : undefined;
  const saved = cart.reduce((n, l) => n + (l.oldPrice ? (l.oldPrice - l.price) * l.quantity : 0), 0);
  const go = (to) => { onClose?.(); navigate(to); };
  const toMin = settings.minimumOrder - totals.subtotal;

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center justify-between bg-white px-5 py-4">
        <h2 className="text-lg font-extrabold">My Cart</h2>
        {onClose && <button onClick={onClose} aria-label="Close cart" className="rounded-full p-1 hover:bg-[#f2f2f2]"><X size={22} /></button>}
      </div>

      {!cart.length ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white"><ShoppingBag size={48} className="text-[#ccc]" /></div>
          <p className="mt-5 text-lg font-extrabold">You don’t have any items in your cart</p>
          <p className="mt-1 text-sm text-muted">Your favourite items are just a click away</p>
          <button onClick={() => go('/')} className="btn-primary mt-6 py-2.5">Start Shopping</button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {saved > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[#e5f3ff] px-4 py-2.5 text-sm font-bold text-blue">
                <span>Your total savings</span><span>{sgd(saved)}</span>
              </div>
            )}
            <div className="rounded-xl bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f2f2]">{pickup ? <Store size={22} /> : <Timer size={22} />}</span>
                <div className="flex-1">
                  <p className="font-extrabold">{pickup ? (pickupSelection ? `Pickup at ${pickupSelection.hubName}` : 'Store pickup') : 'Delivery today or tomorrow'}</p>
                  <p className="text-xs text-muted">Shipment of {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}</p>
                </div>
                <button onClick={() => setMode(pickup ? 'ONLINE_DELIVERY' : 'STORE_PICKUP')} className="text-xs font-bold text-brand">{pickup ? 'Get delivery' : 'Pick up instead'}</button>
              </div>
              <div className="mt-4 space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <Link to={`/product/${item.id}`} onClick={onClose} className="shrink-0 rounded-lg border border-line p-1"><img src={item.image} alt="" className="h-14 w-14 rounded object-contain" /></Link>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] leading-tight">{item.name}</p>
                      {item.size && <p className="text-xs text-muted">{item.size}</p>}
                      <p className="mt-0.5 text-[13px] font-extrabold">{sgd(item.price)} {item.oldPrice && <span className="font-normal text-[#999] line-through">{sgd(item.oldPrice)}</span>}</p>
                    </div>
                    <QuantityControl product={item} />
                  </div>
                ))}
              </div>
            </div>

            {!pickup && toMin > 0 && settings.smallOrderFeeEnabled && (
              <div className="rounded-xl bg-white p-4 text-sm">
                <p>Add <b>{sgd(toMin)}</b> more to skip the {sgd(settings.smallOrderFee)} small order fee</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee]"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (totals.subtotal / settings.minimumOrder) * 100)}%` }} /></div>
              </div>
            )}

            <VoucherBox />

            <div className="rounded-xl bg-white p-4">
              <p className="mb-3 flex items-center gap-2 font-extrabold"><FileText size={16} /> Bill details</p>
              <Summary totals={totals} pickup={pickup} voucher={eligibleVoucher} />
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="font-extrabold">Cancellation Policy</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">Orders can be cancelled while they are awaiting payment confirmation. Reserved points and vouchers are released on cancellation.</p>
            </div>
          </div>
          <div className="bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <button onClick={() => go(user ? '/checkout' : '/login?next=/checkout')} className="flex w-full items-center justify-between rounded-xl bg-brand px-4 py-3 text-white transition hover:bg-brand-dark">
              <span className="text-left leading-tight"><span className="block font-extrabold">{sgd(totals.total - voucherDiscount(eligibleVoucher, totals.subtotal))}</span><span className="text-[11px] font-semibold uppercase opacity-80">Total</span></span>
              <span className="flex items-center gap-1 font-extrabold">{user ? 'Proceed' : 'Login to Proceed'} <ChevronRight size={20} /></span>
            </button>
            <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted"><Bike size={12} /> Final total confirmed by the store at checkout</p>
          </div>
        </>
      )}
    </div>
  );
}
