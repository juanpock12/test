import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from './api';
import { usePoll } from './usePoll';
import { euro, STATUS_LABELS } from './format';

// Customer's order history (FR09)
export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  usePoll(() => ordersApi.mine().then(setOrders, (e) => setError(e.message)), 5000);

  if (error && !orders) return <p className="cb-card cb-error">{error}</p>;
  return (
    <section className="cb-card" aria-label="My orders">
      <h2>My orders</h2>
      {!orders && <p className="cb-muted">Loading…</p>}
      {orders && orders.length === 0 && <p className="cb-muted">No orders yet.</p>}
      <ul className="cb-orders">
        {(orders || []).map((o) => (
          <li key={o.id}>
            <button className="cb-order-row" onClick={() => navigate(`/customer/orders/${o.id}`)}>
              <span><strong>#{o.id}</strong> · {o.restaurant_name}</span>
              <span>{euro(o.total_cents)}</span>
              <span className={`cb-badge cb-st-${o.status.toLowerCase()}`}>{STATUS_LABELS[o.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
