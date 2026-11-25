
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { restaurantsApi } from '../restaurants/api';
import { addToBasket, basketCount, useBasket } from './basketStore';
import { euro } from './format';

export default function OrderFood() {
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId');

  const [restaurants, setRestaurants] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState({});

  const basket = useBasket();

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const restaurantList = await restaurantsApi.list();

        if (cancelled) return;

        setRestaurants(restaurantList);

        if (restaurantId) {
          const selected = restaurantList.find(
            (r) => String(r.id) === String(restaurantId)
          );

          if (!selected) {
            throw new Error('Restaurant not found.');
          }

          const items = await restaurantsApi.menu(restaurantId);

          if (cancelled) return;

          setRestaurant(selected);
          setMenu(items);
        } else {
          setRestaurant(null);
          setMenu([]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  function add(item) {
    let text = 'Added ✓';

    try {
      addToBasket(item);
    } catch (err) {
      text = err.message;
    }

    setMsg((current) => ({ ...current, [item.id]: text }));

    setTimeout(() => {
      setMsg((current) => ({ ...current, [item.id]: null }));
    }, 2500);
  }

  if (loading) {
    return <p className="cb-card cb-muted">Loading...</p>;
  }

  if (error) {
    return (
      <div className="cb-card cb-error">
        <p>{error}</p>
        <Link to="/customer/order">Back to restaurants</Link>
      </div>
    );
  }

  // No restaurant selected: show the restaurant list.
  if (!restaurantId) {
    return (
      <>
        <h1>Choose a restaurant</h1>

        {restaurants.length === 0 && (
          <p className="cb-card cb-muted">No restaurants available.</p>
        )}

        {restaurants.map((r) => (
          <section className="cb-card" key={r.id}>
            <h2>{r.name}</h2>
            <p>{r.available_item_count} items available</p>
            <Link to={`/customer/order?restaurantId=${r.id}`}>
              View menu
            </Link>
          </section>
        ))}
      </>
    );
  }

  // Restaurant selected: show only its menu.
  return (
    <>
      <p>
        <Link to="/customer/order">← Back to restaurants</Link>
      </p>

      <section className="cb-card">
        <h1>{restaurant?.name}</h1>
        <p>Choose items from this restaurant's menu.</p>

        {menu.length === 0 && (
          <p className="cb-muted">This restaurant has no menu items yet.</p>
        )}

        {menu.map((item) => (
          <div className="cb-menu-item" key={item.id}>
            <span>
              <strong>{item.name}</strong>

              {item.description && <span> — {item.description}</span>}

              {!item.available && (
                <span className="cb-badge cb-badge-warn">
                  Sold out
                </span>
              )}

              {msg[item.id] && (
                <span className="cb-add-msg"> {msg[item.id]}</span>
              )}
            </span>

            <span className="cb-price">
              {euro(item.price_cents)}
            </span>

            <button
              className="cb-btn cb-btn-small"
              disabled={!item.available}
              onClick={() => add(item)}
            >
              {item.available ? 'Add' : 'Sold out'}
            </button>
          </div>
        ))}
      </section>

      {basketCount(basket) > 0 && (
        <div className="cb-actions">
          <Link className="cb-btn" to="/customer/basket">
            Go to basket ({basketCount(basket)})
          </Link>
        </div>
      )}
    </>
  );
}
