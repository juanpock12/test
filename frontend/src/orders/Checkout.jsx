import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ordersApi } from './api';
import { basketTotal, clearBasket, useBasket } from './basketStore';
import { euro, PAYMENT_METHODS } from './format';

// Checkout with a SIMULATED payment. No real card details are ever collected.
export default function Checkout() {
  const basket = useBasket();
  const navigate = useNavigate();
  const [method, setMethod] = useState('CAMPUS_CARD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // One key per visit: a double-click sends the same key, so only one order is created
  const idempotencyKey = useMemo(() => `chk-${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  if (basket.lines.length === 0 && !busy) return <Navigate to="/customer/basket" replace />;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const order = await ordersApi.place({
        restaurantId: basket.restaurantId,
        items: basket.lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
        paymentMethod: method,
        idempotencyKey,
      });
      clearBasket();
      navigate(`/customer/orders/${order.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <section className="cb-card" aria-label="Checkout">
      <h2>Checkout</h2>
      <ul className="cb-lines cb-lines-compact">
        {basket.lines.map((l) => (
          <li key={l.menuItemId} className="cb-line">
            <span className="cb-line-name">{l.qty} × {l.name}</span>
            <span className="cb-price">{euro(l.priceCents * l.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="cb-total"><span>Total to pay</span><strong>{euro(basketTotal(basket))}</strong></div>
      <fieldset className="cb-methods">
        <legend>Payment method <span className="cb-badge">Simulated</span></legend>
        {PAYMENT_METHODS.map((m) => (
          <label key={m.value} className="cb-method">
            <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />
            <span>{m.label}<small>{m.hint}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="cb-muted cb-small">Prototype: no real payment is taken and no card details are stored.</p>
      {error && <p className="cb-error" role="alert">{error}</p>}
      <div className="cb-actions">
        <button className="cb-btn cb-btn-ghost" onClick={() => navigate('/customer/basket')} disabled={busy}>Back to basket</button>
        <button className="cb-btn" onClick={pay} disabled={busy}>{busy ? 'Processing payment…' : `Pay ${euro(basketTotal(basket))}`}</button>
      </div>
    </section>
  );
}
