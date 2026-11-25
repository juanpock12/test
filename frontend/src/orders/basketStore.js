// The basket lives in the browser until checkout (one basket per logged-in customer).
// Rule: one restaurant per basket. Prices here are only for display;
// the backend recalculates the total from the database.
import { useEffect, useState } from 'react';
import { getUser } from '../session';

const key = () => `campusbites.basket.${getUser()?.id ?? 'guest'}`;
const empty = () => ({ restaurantId: null, restaurantName: '', lines: [] });

export function loadBasket() {
  try {
    return JSON.parse(localStorage.getItem(key())) || empty();
  } catch {
    return empty();
  }
}

function save(b) {
  localStorage.setItem(key(), JSON.stringify(b));
  window.dispatchEvent(new Event('campusbites-basket'));
}

export function addToBasket(item) {
  const b = loadBasket();
  if (!item.available) throw new Error(`${item.name} is sold out.`);
  if (b.restaurantId && String(b.restaurantId) !== String(item.restaurant_id)) {
    throw new Error('Your basket has items from another restaurant. Clear it first.');
  }
  const line = b.lines.find((l) => l.menuItemId === item.id);
  if (line) line.qty = Math.min(line.qty + 1, 20);
  else b.lines.push({ menuItemId: item.id, name: item.name, priceCents: item.price_cents, qty: 1 });
  save({ ...b, restaurantId: item.restaurant_id, restaurantName: item.restaurant_name });
}

export function setQty(menuItemId, qty) {
  const b = loadBasket();
  const lines = b.lines
    .map((l) => (l.menuItemId === menuItemId ? { ...l, qty: Math.min(qty, 20) } : l))
    .filter((l) => l.qty > 0);
  save(lines.length ? { ...b, lines } : empty());
}

export const clearBasket = () => save(empty());
export const basketTotal = (b) => b.lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
export const basketCount = (b) => b.lines.reduce((n, l) => n + l.qty, 0);

export function useBasket() {
  const [basket, setBasket] = useState(loadBasket);
  useEffect(() => {
    const sync = () => setBasket(loadBasket());
    window.addEventListener('campusbites-basket', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('campusbites-basket', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return basket;
}
