import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ShopProvider } from './store/ShopContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import { AllCategories, CategoryPage, CollectionPage, SearchPage } from './pages/Browse';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import { OrderDetail, OrdersPage } from './pages/Orders';
import { AccountPage, NotFound, OffersPage, TermsPage, WishlistPage } from './pages/Account';

export default function App() {
  return (
    <ShopProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="categories" element={<AllCategories />} />
            <Route path="category/:id" element={<CategoryPage />} />
            <Route path="collection/:id" element={<CollectionPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="product/:id" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="login" element={<Login />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="offers" element={<OffersPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ShopProvider>
  );
}
