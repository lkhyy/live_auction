import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

/** 等待 zustand persist 从 localStorage 恢复，避免未水合就跳转登录 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
