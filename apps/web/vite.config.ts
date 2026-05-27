import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** 开发时 admin 模式：所有 SPA 路由回落到 admin.html */
function adminDevSpaPlugin(): Plugin {
  return {
    name: 'admin-dev-spa',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = req.url?.split('?')[0] ?? '';
        // Vite 内部模块、源码、带扩展名的静态资源
        if (
          url.startsWith('/@') ||
          url.startsWith('/node_modules/') ||
          url.startsWith('/src/') ||
          (url.includes('.') && !url.endsWith('.html'))
        ) {
          return next();
        }
        req.url = '/admin.html';
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isAdmin = mode === 'admin';
  const envDir = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, envDir, '');
  const adminBase = env.VITE_ADMIN_BASE || '/';

  return {
    base: isAdmin ? adminBase : '/',
    plugins: [react(), ...(isAdmin ? [adminDevSpaPlugin()] : [])],
    envDir,
    define: {
      'import.meta.env.VITE_APP_TARGET': JSON.stringify(
        env.VITE_APP_TARGET ?? (isAdmin ? 'admin' : 'user'),
      ),
    },
    resolve: {
      alias: {
        '@live-auction/shared': path.resolve(__dirname, '../../packages/shared/src'),
      },
    },
    optimizeDeps: {
      include: [
        'antd-mobile',
        'antd-mobile/es/global',
        'antd-mobile-icons',
        ...(isAdmin ? ['@ant-design/icons'] : []),
      ],
    },
    build: {
      outDir: isAdmin ? 'dist-admin' : 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, isAdmin ? 'admin.html' : 'index.html'),
      },
    },
    server: {
      // 默认只绑 [::1]，Windows 上用 127.0.0.1 会连不上导致白屏
      host: true,
      port: isAdmin ? 5174 : 5173,
      strictPort: true,
      open: isAdmin ? '/' : undefined,
      watch: {
        ignored: ['**/dist/**', '**/dist-admin/**'],
      },
      proxy: {
        // 手机/LAN 访问 192.168.x:5173 时，API 走同源代理到本机 3000
        '^/(auth|lots|auctions|live-rooms|orders|me)': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
