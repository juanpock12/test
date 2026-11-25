import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi } from './api';
import { usePoll } from './usePoll';
import { euro, PAYMENT_METHODS, STATUS_LABELS, TRACKING_STEPS } from './format';

export function StatusTimeline({ order }) {
  if (order.status === 'REJECTED') {
    return <p className="cb-status cb-status-bad">Rejected by the restaurant: refunded (simulated).</p>;
  }
  const current = order.status === 'COMPLETED' ? TRACKING_STEPS.length : TRACKING_STEPS.indexOf(order.status);
  return (
    <ol className="cb-timeline" aria-label="Order progress">
      {TRACKING_STEPS.map((step, i) => (
        <li key={step} className={i < current ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="cb-dot" />
          {STATUS_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}

// Live order tracking: refreshes every 3 seconds, so restaurant updates appear by themselves
export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState('CAMPUS_CARD');
  const [busy, setBusy] = useState(false);

  usePoll(() => ordersApi.get(id).then(setOrder, (e) => setError(e.message)), 3000, [id]);

  if (error && !order) return <p className="cb-card cb-error">{error}</p>;
  if (!order) return <p className="cb-card cb-muted">Loading order…</p>;

  async function retry() {
    setBusy(true);
    try {
      setOrder(await ordersApi.retryPayment(order.id, method));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <section className="cb-card" aria-label={`Order ${order.id}`}>
      <div className="cb-row">
        <h2>Order #{order.id}</h2>
        <span className={`cb-badge cb-st-${order.status.toLowerCase()}`}>{STATUS_LABELS[order.status]}</span>
      </div>
      <p className="cb-muted">{order.restaurant_name} · {new Date(order.created_at).toLocaleString()}</p>

      {order.status === 'PENDING_PAYMENT' && <p className="cb-status">Processing payment…</p>}
      {order.status === 'PAYMENT_FAILED' && (
        <div className="cb-status cb-status-bad">
          <p>Your payment was declined. Choose another method and try again.</p>
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>{' '}
          <button className="cb-btn" disabled={busy} onClick={retry}>{busy ? 'Processing…' : 'Retry payment'}</button>
        </div>
      )}
      {(order.status === 'REJECTED' || TRACKING_STEPS.includes(order.status)) && <StatusTimeline order={order} />}

      <ul className="cb-lines cb-lines-compact">
        {order.items.map((i) => (
          <li key={i.menuItemId} className="cb-line">
            <span className="cb-line-name">{i.qty} × {i.name}</span>
            <span className="cb-price">{euro(i.unitPriceCents * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="cb-total"><span>Total</span><strong>{euro(order.total_cents)}</strong></div>
      <Link className="cb-btn cb-btn-ghost" to="/customer/orders">All my orders</Link>
    </section>
  );
}
