/** 开发时 .env 里常见的本机 API 地址；手机/LAN 访问时应走 Vite 代理而非直连 */
function isLoopbackDevUrl(url: string | undefined): boolean {
  if (!url) return true;
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** HTTP API 根路径：开发 + 环回配置 → 同源（经 Vite 代理到 3000） */
export function apiBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (import.meta.env.DEV && isLoopbackDevUrl(env)) {
    return '';
  }
  return (env ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** Socket.io 根路径：开发/生产同源部署 → 当前页面 origin */
export function wsBaseUrl(): string {
  const env = (import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL) as
    | string
    | undefined;
  if (import.meta.env.DEV && isLoopbackDevUrl(env)) {
    return window.location.origin;
  }
  if (!env) {
    return window.location.origin;
  }
  return env.replace(/\/$/, '');
}
