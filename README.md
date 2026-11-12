# Lowest Price SG Mart: website

The customer website for Lowest Price SG Mart. It uses **the same Supabase backend** as the
customer app (`Lowest-sg-mart-customer-app-30`), so products, prices, promotions, flash sales,
vouchers, delivery slots, pickup hubs, orders, loyalty points, wishlists and reviews are shared.
Changes made in the admin app show up here automatically.

## Setup

```bash
cp .env.example .env   # fill in the same Supabase URL + publishable key the app uses
npm install
npm run dev
```

| Variable | Same as app's |
| --- | --- |
| `VITE_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

## Structure

- `src/lib/`: backend calls ported from the app's `src/lib` (catalogue pricing, vouchers, OTP login, checkout quote/booking, orders, wishlist)
- `src/store/ShopContext.jsx`: session, live catalogue, cart, wishlist, loyalty
- `src/pages/`: Home, Categories/Category/Search/Collection, Product, Cart, Checkout, Login, Orders, Account, Wishlist, Offers, Terms
- `src/components/Fulfillment.jsx`: store-pickup hub/time picker and delivery-slot picker (same RPCs as the app)

Checkout totals are always verified server-side (`quote_retail_order` / `quote_delivery_order`)
and orders are placed with `book_retail_order` / `book_delivery_order`, exactly like the app.

When deploying as a single-page app, rewrite all paths to `index.html` (e.g. Vercel/Netlify SPA fallback).
