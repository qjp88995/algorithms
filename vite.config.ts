import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * 纯前端站点，没有后端，所以不需要任何代理。
 *
 * 容器内开发时浏览器直接访问宿主机映射的 ${WEB_PORT}，
 * HMR 的 WebSocket 也走同一个端口，因此要显式告诉客户端
 * clientPort，否则它会去连容器内部的 5173。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const insideDocker = env.RUNNING_IN_DOCKER === '1';
  const webPort = Number(env.WEB_PORT ?? 5173);

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: insideDocker ? { clientPort: webPort } : true,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.spec.ts'],
    },
  };
});
