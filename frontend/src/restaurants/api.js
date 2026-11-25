
import { API_URL } from '../api';

async function request(path) {
  const res = await fetch(`${API_URL}/restaurants${path}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Could not load restaurants');
  }

  return data;
}

export const restaurantsApi = {
  list: (search = '', openOnly = false) => {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (openOnly) params.set('openOnly', 'true');

    const query = params.toString();
    return request(query ? `?${query}` : '');
  },

  menu: (restaurantId) => request(`/${restaurantId}/menu`),
};
