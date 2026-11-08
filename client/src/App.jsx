import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { languageChosen } from './i18n';
import Welcome from './pages/Welcome';
import PassportSetup from './pages/PassportSetup';
import Courier from './pages/Courier';
import { Layout, ProtectedRoute, RoleRoute } from './components/Layout';
import Home from './pages/Home';
import RestaurantDetail from './pages/RestaurantDetail';
import { Login, Register } from './pages/Auth';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import { OrderDetail, OrderList } from './pages/Orders';
import Profile, { CardCallback } from './pages/Profile';
import ManagerDashboard from './pages/manage/Dashboard';
import RestaurantForm from './pages/manage/RestaurantForm';
import MenuManage from './pages/manage/MenuManage';
import OrdersDesk from './pages/manage/OrdersDesk';
import { AdminDashboard, AdminRestaurants, AdminReviews, AdminUsers } from './pages/admin/Admin';
import AdminDishes from './pages/admin/AdminDishes';
import { NotFound } from './pages/StatusPages';

const customer = (el) => <RoleRoute roles={['customer']}>{el}</RoleRoute>;
const staff = (el) => <RoleRoute roles={['manager', 'admin']}>{el}</RoleRoute>;
const admin = (el) => <RoleRoute roles={['admin']}>{el}</RoleRoute>;

/** First visit to the home page -> language picker (deep links such as a shared restaurant open directly). */
function HomeGate() {
  const location = useLocation();
  if (!languageChosen()) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeGate />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="passport" element={<PassportSetup />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="cart" element={<Cart />} />

        <Route path="checkout" element={customer(<Checkout />)} />
        <Route path="orders" element={customer(<OrderList />)} />
        <Route path="orders/:id" element={customer(<OrderDetail />)} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="cards/callback" element={customer(<CardCallback />)} />

        <Route path="courier" element={<RoleRoute roles={['courier']}><Courier /></RoleRoute>} />
        <Route path="manage" element={<RoleRoute roles={['manager']}><ManagerDashboard /></RoleRoute>} />
        <Route path="manage/orders" element={staff(<OrdersDesk />)} />
        <Route path="manage/restaurants/new" element={staff(<RestaurantForm />)} />
        <Route path="manage/restaurants/:id/edit" element={staff(<RestaurantForm />)} />
        <Route path="manage/restaurants/:id/menu" element={staff(<MenuManage />)} />

        <Route path="admin" element={admin(<AdminDashboard />)} />
        <Route path="admin/users" element={admin(<AdminUsers />)} />
        <Route path="admin/restaurants" element={admin(<AdminRestaurants />)} />
        <Route path="admin/restaurants/new" element={admin(<RestaurantForm />)} />
        <Route path="admin/reviews" element={admin(<AdminReviews />)} />
        <Route path="admin/dishes" element={admin(<AdminDishes />)} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
