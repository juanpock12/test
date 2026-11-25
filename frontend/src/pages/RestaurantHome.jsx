import { Link, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../session';

export default function RestaurantHome() {
  const user = getUser();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'sans-serif' }}>
      <h1>Restaurant dashboard</h1>
      <p>Welcome, {user?.email}</p>
      <p>Menu management and incoming orders will appear here.</p>
      <p><Link to="/restaurant/orders">Incoming orders</Link></p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}