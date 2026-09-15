import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 关闭自动清空 dist：当前环境的安全删除 shim 会拦截 Vite 清空目录的删除操作导致构建失败；
  // 改为增量覆盖，旧哈希资源会成为孤儿文件，可手动清理 dist 后重新 build。
  build: {
    emptyOutDir: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
