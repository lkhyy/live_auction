/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TARGET: 'user' | 'admin';
  readonly VITE_USER_APP_URL: string;
  readonly VITE_ADMIN_APP_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
