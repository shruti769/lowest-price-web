import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck, Tag, Truck } from 'lucide-react';
import { PHONE_COUNTRIES, sendPhoneOtp, toAuthPhone, verifyPhoneOtp } from '../lib/account';
import { useShop } from '../store/ShopContext';
import { Logo } from '../components/Layout';

const RESEND_SECONDS = 30;

export default function Login() {
  const { user, authReady, profile, setProfile } = useShop();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const navigate = useNavigate();
  const [country, setCountry] = useState('SG');
  const [phone, setPhone] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const codeRef = useRef(null);
  const c = PHONE_COUNTRIES[country];

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (authPhone) codeRef.current?.focus(); }, [authPhone]);

  if (authReady && user && !needsName) return <Navigate to={next} replace />;

  const send = async (e) => {
    e?.preventDefault();
    const p = authPhone || toAuthPhone(phone, country);
    if (!p) return setError(`Enter a valid ${c.length} digit ${c.label} mobile number.`);
    setBusy(true); setError('');
    try { await sendPhoneOtp(p); setAuthPhone(p); setSentAt(Date.now()); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the full 6-digit code.');
    setBusy(true); setError('');
    try {
      const session = await verifyPhoneOtp(authPhone, code);
      const meta = session.user?.user_metadata ?? {};
      if (!profile?.fullName && !meta.full_name && !meta.fullName) setNeedsName(true);
      else navigate(next, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const saveName = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name.');
    setProfile({ ...(profile ?? {}), fullName: name.trim(), email: email.trim(), phoneNumber: authPhone, joinedAt: profile?.joinedAt ?? new Date().toISOString() });
    navigate(next, { replace: true });
  };

  const wait = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
      <div className="hidden flex-col justify-center rounded-3xl bg-gradient-to-br from-[#0c831f] via-[#1aa035] to-[#5cc45a] p-10 text-white md:flex">
        <h2 className="text-4xl font-extrabold leading-tight">Lowest prices.<br />Every single day.</h2>
        <ul className="mt-8 space-y-4 text-white/90">
          <li className="flex items-center gap-3"><Truck /> Delivery today or tomorrow</li>
          <li className="flex items-center gap-3"><Tag /> Exclusive vouchers and loyalty points</li>
          <li className="flex items-center gap-3"><ShieldCheck /> One account across the app and the website</li>
        </ul>
      </div>

      <div className="mx-auto w-full max-w-md">
        <Logo className="h-12" />
        {needsName ? (
          <form onSubmit={saveName} className="mt-8 animate-rise">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Almost done</p>
            <h1 className="mt-2 text-4xl font-extrabold">About you<span className="text-brand">.</span></h1>
            <p className="mt-2 text-muted">Tell us your name so we can personalise your orders.</p>
            <label className="mt-8 block text-xs font-bold uppercase tracking-wider text-muted">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-2" autoFocus />
            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Email (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-2" />
            {error && <p className="mt-3 text-sm text-[#b91c1c]">{error}</p>}
            <button className="btn-primary mt-6 w-full py-3.5">Continue</button>
          </form>
        ) : !authPhone ? (
          <form onSubmit={send} className="mt-8 animate-rise">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Sign in or create account</p>
            <h1 className="mt-2 text-4xl font-extrabold">Welcome<span className="text-brand">.</span></h1>
            <p className="mt-2 text-muted">Sign in to continue, or create an account in 60 seconds.</p>
            <label className="mt-8 block text-xs font-bold uppercase tracking-wider text-muted">Mobile number</label>
            <div className="mt-2 flex h-14 items-center rounded-xl border border-line bg-[#f7f7f7] focus-within:border-brand focus-within:bg-white">
              <button type="button" onClick={() => { setCountry(country === 'SG' ? 'IN' : 'SG'); setPhone(''); setError(''); }} className="flex h-full items-center gap-2 px-4" aria-label={`Country ${c.label}, click to switch`}>
                <img src={c.flag} alt="" className="h-5 w-7 rounded-sm object-cover" />
                <span className="font-bold">{c.code} ▾</span>
              </button>
              <span className="h-7 w-px bg-line" />
              <input inputMode="numeric" autoFocus value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, c.length)); setError(''); }} placeholder={c.placeholder} className="h-full flex-1 bg-transparent px-4 text-lg font-semibold tracking-wider outline-none" />
            </div>
            {error && <p className="mt-3 text-sm text-[#b91c1c]">{error}</p>}
            <button disabled={busy} className="btn-primary mt-6 w-full py-3.5 text-base">{busy ? <><Loader2 size={18} className="animate-spin" /> Sending OTP…</> : 'Continue with mobile'}</button>
            <p className="mt-6 text-center text-xs text-muted">By continuing you agree to our <a href="/terms" className="font-semibold text-brand">Terms & Privacy</a>.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-8 animate-rise">
            <button type="button" onClick={() => { setAuthPhone(''); setCode(''); setError(''); }} className="mb-4 flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft size={16} /> Change number</button>
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Verify your number</p>
            <h1 className="mt-2 text-4xl font-extrabold">Enter code<span className="text-brand">.</span></h1>
            <p className="mt-2 text-muted">We sent a code by SMS to <b className="text-ink">{authPhone}</b>.</p>
            <input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="••••••" maxLength={6} className="input mt-8 h-16 text-center text-3xl font-extrabold tracking-[0.5em]" />
            {error && <p className="mt-3 text-sm text-[#b91c1c]">{error}</p>}
            <button disabled={busy} className="btn-primary mt-6 w-full py-3.5 text-base">{busy ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : 'Verify & continue'}</button>
            <button type="button" disabled={wait > 0 || busy} onClick={send} className="mt-4 w-full text-sm font-bold text-brand disabled:text-muted">{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
