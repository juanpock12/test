
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../session';
import { restaurantsApi } from '../restaurants/api';

export default function CustomerHome() {
  const user = getUser();
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState([]);
  const [search, setSearch] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    restaurantsApi.list(search, openOnly)
      .then((data) => {
        if (!cancelled) setRestaurants(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, openOnly]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{
      maxWidth: 900,
      margin: '40px auto',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <h1>Welcome to CampusBites!</h1>
      <p>Welcome, {user?.name || user?.email}</p>

      <h2>Browse campus restaurants</h2>
      <p>Discover restaurants and find something delicious to order.</p>

      {/* Restaurant search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search restaurants by name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            padding: '10px',
            width: '100%',
            maxWidth: '400px',
            marginBottom: '12px'
          }}
        />

        <label style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
          />
          {' '}Show restaurants with available menu items only
        </label>
      </div>

      {loading && <p>Loading restaurants...</p>}

      {error && (
        <p style={{ color: 'red' }}>
          Could not load restaurants: {error}
        </p>
      )}

      {!loading && !error && restaurants.length === 0 && (
        <p>No restaurants found. Try another search.</p>
      )}

      {/* Restaurant cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {restaurants.map((restaurant) => (
          <div
            key={restaurant.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '10px',
              padding: '20px',
              backgroundColor: '#fff'
            }}
          >
            <h3>{restaurant.name}</h3>

            <p>{restaurant.menu_item_count} menu items</p>

            <p>
              {restaurant.available_item_count} items currently available
            </p>

            <Link to={`/customer/order?restaurantId=${restaurant.id}`}>
              View menu
            </Link>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '30px' }}>
        <p>
          <Link to="/customer/orders">My orders</Link>
        </p>

        <button onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
