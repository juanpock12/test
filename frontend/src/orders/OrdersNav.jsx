import { NavLink, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../session';
import { basketCount, useBasket } from './basketStore';
import NotificationBell from './NotificationBell';
import './orders.css';

// Top bar for the ordering pages
export default function OrdersNav() {
  const user = getUser();
  const navigate = useNavigate();
  const basket = useBasket();
  const cls = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <nav className="cb-nav">
      <strong>CampusBites</strong>
      {user?.role === 'customer' ? (
        <>
          <NavLink to="/customer/order" className={cls}>Order food</NavLink>
          <NavLink to="/customer/basket" className={cls}>Basket ({basketCount(basket)})</NavLink>
          <NavLink to="/customer/orders" className={cls} end>My orders</NavLink>
        </>
      ) : (
        <NavLink to="/restaurant/orders" className={cls}>Incoming orders</NavLink>
      )}
      <span className="cb-spacer" />
      <NotificationBell />
      <button className="cb-btn cb-btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
    </nav>
  );
}
