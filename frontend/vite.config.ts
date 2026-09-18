import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `npm run dev` chạy ở cổng 5173 và chuyển tiếp /api sang máy chủ Python.
// Nhờ vậy lúc lập trình cũng chỉ có MỘT địa chỉ, giống hệt lúc chạy thật.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Phải khớp PORT trong backend/app/main.py. Để sai số ở đây là lúc
        // lập trình sẽ gọi nhầm sang API của tool khác mà không báo lỗi gì.
        target: 'http://127.0.0.1:8770',
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
