/** 编译期固定：user | admin 两套独立前端 */
export type AppTarget = 'user' | 'admin';

export function appTarget(): AppTarget {
  return import.meta.env.VITE_APP_TARGET === 'admin' ? 'admin' : 'user';
}

export function isAdminApp(): boolean {
  return appTarget() === 'admin';
}

export function isUserApp(): boolean {
  return appTarget() === 'user';
}

export function authPersistName(): string {
  return isAdminApp() ? 'live-auction-auth-admin' : 'live-auction-auth-user';
}

export function tokenStorageKey(): string {
  return isAdminApp() ? 'accessTokenAdmin' : 'accessTokenUser';
}

export function userAppUrl(): string {
  return (import.meta.env.VITE_USER_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');
}

export function adminAppUrl(): string {
  return (import.meta.env.VITE_ADMIN_APP_URL ?? 'http://localhost:5174').replace(/\/$/, '');
}
