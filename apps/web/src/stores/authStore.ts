import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  authPersistName,
  isAdminApp,
  isUserApp,
  tokenStorageKey,
} from '../lib/appConfig';

interface User {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem(tokenStorageKey(), token);
        set({ token, user });
      },
      updateUser: (patch) => {
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, ...patch } };
        });
      },
      logout: () => {
        localStorage.removeItem(tokenStorageKey());
        set({ token: null, user: null });
      },
    }),
    {
      name: authPersistName(),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem(tokenStorageKey(), state.token);
        }
      },
    },
  ),
);

function migrateLegacyPersist(target: 'user' | 'admin') {
  const legacyKey = 'live-auction-auth';
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      state?: { token?: string; user?: { role?: string; id?: string; email?: string; displayName?: string } };
    };
    const role = parsed.state?.user?.role;
    const token = parsed.state?.token;
    if (!token) return;
    const isStaff = role === 'HOST' || role === 'ADMIN';
    if (target === 'admin' && !isStaff) return;
    if (target === 'user' && isStaff) return;
    const key = tokenStorageKey();
    if (!localStorage.getItem(key)) localStorage.setItem(key, token);
    if (!useAuthStore.getState().token) {
      const u = parsed.state?.user;
      useAuthStore.setState({
        token,
        user:
          u?.id && u.email && u.displayName && u.role
            ? { id: u.id, email: u.email, displayName: u.displayName, role: u.role }
            : null,
      });
    }
  } catch {
    /* ignore */
  }
}

function migrateLegacyTokens() {
  if (isUserApp()) {
    const key = tokenStorageKey();
    if (!localStorage.getItem(key)) {
      const legacy =
        localStorage.getItem('accessToken') ?? localStorage.getItem('accessTokenUser');
      if (legacy) localStorage.setItem(key, legacy);
    }
    migrateLegacyPersist('user');
  }
  if (isAdminApp()) {
    const key = tokenStorageKey();
    if (!localStorage.getItem(key)) {
      const legacy =
        localStorage.getItem('accessToken') ?? localStorage.getItem('accessTokenAdmin');
      if (legacy) localStorage.setItem(key, legacy);
    }
    migrateLegacyPersist('admin');
  }
}

migrateLegacyTokens();
