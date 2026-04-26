import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/badminton-app/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    include: ['src/test/**/*.test.{js,jsx}'],
    globals: true,
    css: true,
  },
})
