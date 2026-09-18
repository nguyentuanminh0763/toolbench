import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run dev` chạy ở cổng 5173 và chuyển tiếp /api sang máy chủ Python.
// Nhờ vậy lúc lập trình cũng chỉ có MỘT địa chỉ, giống hệt lúc chạy thật.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
    },
  },
  build: {
    // FastAPI phục vụ thẳng thư mục này. Đường dẫn phải khớp WEB_DIST trong main.py.
    outDir: 'dist',
    emptyOutDir: true,
  },
})
