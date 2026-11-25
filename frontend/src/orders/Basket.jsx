import { Link, useNavigate } from 'react-router-dom';
import { basketCount, basketTotal, clearBasket, setQty, useBasket } from './basketStore';
import { euro } from './format';

export default function Basket() {
  const basket = useBasket();
  const navigate = useNavigate();

  if (basket.lines.length === 0) {
    return (
      <section className="cb-card" aria-label="Basket">
        <h2>Your basket</h2>
        <p className="cb-muted">Your basket is empty.</p>
        <Link className="cb-btn" to="/customer/order">Browse menus</Link>
      </section>
    );
  }
  return (
    <section className="cb-card" aria-label="Basket">
      <h2>Your basket</h2>
      <p className="cb-muted">From {basket.restaurantName}</p>
      <ul className="cb-lines">
        {basket.lines.map((l) => (
          <li key={l.menuItemId} className="cb-line">
            <span className="cb-line-name">{l.name}</span>
            <span className="cb-qty">
              <button aria-label={`Fewer ${l.name}`} onClick={() => setQty(l.menuItemId, l.qty - 1)}>−</button>
              <span aria-live="polite">{l.qty}</span>
              <button aria-label={`More ${l.name}`} onClick={() => setQty(l.menuItemId, l.qty + 1)}>+</button>
            </span>
            <span className="cb-price">{euro(l.priceCents * l.qty)}</span>
            <button className="cb-link" onClick={() => setQty(l.menuItemId, 0)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="cb-total"><span>Total</span><strong>{euro(basketTotal(basket))}</strong></div>
      <div className="cb-actions">
        <button className="cb-btn cb-btn-ghost" onClick={clearBasket}>Clear basket</button>
        <button className="cb-btn" onClick={() => navigate('/customer/checkout')}>
          Go to checkout · {basketCount(basket)} item(s)
        </button>
      </div>
    </section>
  );
}
