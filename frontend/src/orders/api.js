// Calls the Orders backend (/api/orders) with the logged-in user's token
import { API_URL } from '../api';
import { getToken } from '../session';

async function request(method, path, body) {
  const res = await fetch(`${API_URL}/orders${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const ordersApi = {
  place: (order) => request('POST', '', order),
  mine: () => request('GET', '/mine'),
  get: (id) => request('GET', `/${id}`),
  retryPayment: (id, paymentMethod) => request('POST', `/${id}/pay`, { paymentMethod }),
  restaurantQueue: () => request('GET', '/restaurant'),
  advance: (id, expectedVersion) => request('PATCH', `/${id}/status`, { expectedVersion }),
  reject: (id, reason, expectedVersion) => request('POST', `/${id}/reject`, { reason, expectedVersion }),
  notifications: () => request('GET', '/notifications'),
  markRead: () => request('POST', '/notifications/read'),
};
