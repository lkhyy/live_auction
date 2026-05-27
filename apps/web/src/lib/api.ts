import { tokenStorageKey } from './appConfig';
import { apiBaseUrl } from './backendUrl';
import { useAuthStore } from '../stores/authStore';

const API_BASE = apiBaseUrl();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function getToken(): string | null {
  const fromStore = useAuthStore.getState().token;
  if (fromStore) return fromStore;
  return localStorage.getItem(tokenStorageKey());
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
    const message = err.message ?? err.errorCode ?? 'Request failed';
    if (res.status === 401 && token) {
      useAuthStore.getState().logout();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new ApiError(message, res.status);
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
  update: (id: string, data: Record<string, unknown>) =>
    api(`/lots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
  listBids: (id: string) => api<unknown[]>(`/auctions/${id}/bids`),
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
  listMine: () => api<unknown[]>('/live-rooms/mine'),
  listLive: () => api<unknown[]>('/live-rooms/live'),
  get: (roomId: string) => api<Record<string, unknown>>(`/live-rooms/${roomId}`),
  showcase: (roomId: string) =>
    api<import('@live-auction/shared').LiveRoomShowcase>(`/live-rooms/${roomId}/showcase`),
  create: (title: string) =>
    api<Record<string, unknown>>('/live-rooms', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  goLive: (roomId: string) =>
    api<import('@live-auction/shared').LiveRoomShowcase>(`/live-rooms/${roomId}/go-live`, {
      method: 'POST',
    }),
  addAuction: (roomId: string, auctionId: string, sortOrder?: number) =>
    api(`/live-rooms/${roomId}/auctions`, {
      method: 'POST',
      body: JSON.stringify({ auctionId, sortOrder }),
    }),
  switchAuction: (roomId: string, auctionId: string) =>
    api<import('@live-auction/shared').LiveRoomShowcase>(
      `/live-rooms/${roomId}/switch/${auctionId}`,
      { method: 'POST' },
    ),
  detachAuction: (roomId: string, auctionId: string) =>
    api<import('@live-auction/shared').LiveRoomShowcase>(
      `/live-rooms/${roomId}/auctions/${auctionId}`,
      { method: 'DELETE' },
    ),
  clearActive: (roomId: string) =>
    api<import('@live-auction/shared').LiveRoomShowcase>(
      `/live-rooms/${roomId}/clear-active`,
      { method: 'POST' },
    ),
};

export const meApi = {
  profile: () => api<import('@live-auction/shared').MeProfile>('/me'),
  updateProfile: (data: { displayName: string }) =>
    api<import('@live-auction/shared').MeProfile>('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api<{ ok: true }>('/me/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  orders: () => api<unknown[]>('/me/orders'),
  bids: () => api<unknown[]>('/me/bids'),
  participations: () =>
    api<import('@live-auction/shared').MyParticipation[]>('/me/participations'),
  payMock: (orderId: string) =>
    api(`/orders/${orderId}/pay-mock`, { method: 'POST' }),
};
