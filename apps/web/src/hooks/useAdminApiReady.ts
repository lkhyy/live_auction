import { useAuthHydrated } from './useAuthHydrated';
import { useAuthStore } from '../stores/authStore';

/** 管理端 API 需在 persist 恢复且存在 token 后再请求 */
export function useAdminApiReady(): boolean {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  return hydrated && !!token;
}
