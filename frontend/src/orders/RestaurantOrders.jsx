import { useState } from 'react';
import { ordersApi } from './api';
import { usePoll } from './usePoll';
import { euro, STATUS_LABELS } from './format';

const NEXT_ACTION = { RECEIVED: 'Accept & start preparing', PREPARING: 'Mark ready for pickup', READY: 'Mark collected' };

// Incoming paid orders for the logged-in restaurant. Samira can place this in her dashboard.
export default function RestaurantOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const refresh = () => ordersApi.restaurantQueue().then(setOrders, (e) => setError(e.message));
  usePoll(refresh, 3000);

  if (error && !orders) return <p className="cb-card cb-error">{error}</p>;
  const list = orders || [];
  const active = list.filter((o) => ['RECEIVED', 'PREPARING', 'READY'].includes(o.status));
  const done = list.filter((o) => ['COMPLETED', 'REJECTED'].includes(o.status));
  const today = new Date().toDateString();
  const todays = list.filter((o) => new Date(o.created_at).toDateString() === today && o.status !== 'REJECTED');

  return (
    <section className="cb-card" aria-label="Incoming orders">
      <div className="cb-row">
        <h2>Incoming orders</h2>
        <span className="cb-muted">
          Today: {todays.length} {todays.length === 1 ? 'order' : 'orders'} · {euro(todays.reduce((s, o) => s + o.total_cents, 0))}
        </span>
      </div>
      {!orders && <p className="cb-muted">Loading…</p>}
      {orders && active.length === 0 && <p className="cb-muted">No active orders. New paid orders appear here automatically.</p>}
      <ul className="cb-queue">
        {active.map((o) => <QueueRow key={o.id} order={o} onChange={refresh} />)}
      </ul>
      {done.length > 0 && (
        <details>
          <summary>Completed / rejected ({done.length})</summary>
          <ul className="cb-queue">
            {done.map((o) => (
              <li key={o.id} className="cb-queue-row cb-muted">#{o.id} · {euro(o.total_cents)} · {STATUS_LABELS[o.status]}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function QueueRow({ order, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  return (
    <li className="cb-queue-row">
      <div className="cb-row">
        <strong>#{order.id} · {order.customer_name}</strong>
        <span className={`cb-badge cb-st-${order.status.toLowerCase()}`}>{STATUS_LABELS[order.status]}</span>
      </div>
      <p className="cb-small">
        {order.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} · <strong>{euro(order.total_cents)}</strong> · placed{' '}
        {new Date(order.created_at).toLocaleTimeString()}
      </p>
      <div className="cb-actions">
        {order.status === 'RECEIVED' && (
          <button className="cb-btn cb-btn-ghost" disabled={busy}
            onClick={() => run(() => ordersApi.reject(order.id, 'The restaurant could not accept your order.', order.version))}>
            Reject
          </button>
        )}
        <button className="cb-btn" disabled={busy} onClick={() => run(() => ordersApi.advance(order.id, order.version))}>
          {NEXT_ACTION[order.status]}
        </button>
      </div>
      {error && <p className="cb-error" role="alert">{error}</p>}
    </li>
  );
}
