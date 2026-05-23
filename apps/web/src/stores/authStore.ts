import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('accessToken', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ token: null, user: null });
      },
    }),
    { name: 'live-auction-auth' },
  ),
);
