const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

export async function api<T>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? err.errorCode ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: { id: string; email: string; role: string; displayName: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  register: (data: { email: string; password: string; displayName: string; role?: string }) =>
    api<{ accessToken: string; user: { id: string; email: string; role: string; displayName: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
    ),
};

export const lotsApi = {
  list: (mine?: boolean, status?: string) =>
    api<unknown[]>(`/lots${mine ? '?mine=true' : ''}${status ? `${mine ? '&' : '?'}status=${status}` : ''}`),
  create: (data: Record<string, unknown>) =>
    api('/lots', { method: 'POST', body: JSON.stringify(data) }),
  publish: (id: string) => api(`/lots/${id}/publish`, { method: 'POST' }),
};

export const auctionsApi = {
  list: (status?: string) =>
    api<unknown[]>(`/auctions${status ? `?status=${status}` : ''}`),
  get: (id: string) => api<Record<string, unknown>>(`/auctions/${id}`),
  snapshot: (id: string) =>
    api<import('@live-auction/shared').AuctionSnapshot>(`/auctions/${id}/snapshot`),
  dashboard: () => api<unknown[]>('/auctions/dashboard'),
  create: (data: Record<string, unknown>) =>
    api('/auctions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/auctions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  goLive: (id: string) => api(`/auctions/${id}/go-live`, { method: 'POST' }),
  cancel: (id: string, reason: string) =>
    api(`/auctions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  placeBid: (id: string, amount: number, expectedVersion?: number, idempotencyKey?: string) =>
    api<import('@live-auction/shared').BidResult>(`/auctions/${id}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amount, expectedVersion }),
      idempotencyKey,
    }),
};

export const ordersApi = {
  list: () => api<unknown[]>('/orders'),
  get: (id: string) => api<Record<string, unknown>>(`/orders/${id}`),
};

export const liveRoomsApi = {
  list: () => api<unknown[]>('/live-rooms'),
  listLive: () => api<unknown[]>('/live-rooms/live'),
  showcase: (roomId: string) =>
    api<import('@live-auction/shared').LiveRoomShowcase>(`/live-rooms/${roomId}/showcase`),
};

export const meApi = {
  orders: () => api<unknown[]>('/me/orders'),
  bids: () => api<unknown[]>('/me/bids'),
  payMock: (orderId: string) =>
    api(`/orders/${orderId}/pay-mock`, { method: 'POST' }),
};
