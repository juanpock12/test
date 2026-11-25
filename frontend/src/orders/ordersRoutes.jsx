// All Orders pages. App.jsx adds them with one line: {ordersRoutes()}
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import OrdersNav from './OrdersNav';
import OrderFood from './OrderFood';
import Basket from './Basket';
import Checkout from './Checkout';
import MyOrders from './MyOrders';
import OrderTracking from './OrderTracking';
import RestaurantOrders from './RestaurantOrders';

const page = (role, el) => (
  <ProtectedRoute role={role}>
    <div className="cb-page">
      <OrdersNav />
      {el}
    </div>
  </ProtectedRoute>
);

export function ordersRoutes() {
  return (
    <>
      <Route path="/customer/order" element={page('customer', <OrderFood />)} />
      <Route path="/customer/basket" element={page('customer', <Basket />)} />
      <Route path="/customer/checkout" element={page('customer', <Checkout />)} />
      <Route path="/customer/orders" element={page('customer', <MyOrders />)} />
      <Route path="/customer/orders/:id" element={page('customer', <OrderTracking />)} />
      <Route path="/restaurant/orders" element={page('restaurant', <RestaurantOrders />)} />
    </>
  );
}
