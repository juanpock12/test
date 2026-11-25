import { useEffect, useRef, useState } from 'react';
import { ordersApi } from './api';
import { usePoll } from './usePoll';

// Bell with unread count + pop-up toasts for new notifications
export default function NotificationBell() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const lastSeen = useRef(null);
  const box = useRef(null);

  usePoll(async () => {
    try {
      const items = await ordersApi.notifications();
      if (lastSeen.current !== null) {
        const fresh = items.filter((n) => n.id > lastSeen.current).reverse().slice(-3);
        fresh.forEach((n) => {
          setToasts((t) => [...t, n].slice(-3));
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 5000);
        });
      }
      lastSeen.current = items.reduce((m, n) => Math.max(m, n.id), lastSeen.current ?? 0);
      setList(items);
    } catch {
      /* not logged in or server down: try again next time */
    }
  }, 4000);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.key === 'Escape' || (e.type === 'pointerdown' && !box.current?.contains(e.target))) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const unread = list.filter((n) => !n.read).length;
  return (
    <div className="cb-bell" ref={box}>
      <button
        className="cb-btn cb-btn-ghost"
        aria-label={`Notifications, ${unread} unread`}
        onClick={async () => {
          setOpen(!open);
          if (!open && unread) {
            await ordersApi.markRead().catch(() => {});
            setList((l) => l.map((n) => ({ ...n, read: true })));
          }
        }}
      >
        🔔 {unread > 0 && <span className="cb-count">{unread}</span>}
      </button>
      {open && (
        <ul className="cb-bell-list">
          {list.length === 0 && <li className="cb-muted">No notifications yet.</li>}
          {list.slice(0, 10).map((n) => (
            <li key={n.id}>
              {n.message}
              <small>{new Date(n.created_at).toLocaleTimeString()}</small>
            </li>
          ))}
        </ul>
      )}
      <div className="cb-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="cb-toast" role="status">🔔 {t.message}</div>
        ))}
      </div>
    </div>
  );
}
