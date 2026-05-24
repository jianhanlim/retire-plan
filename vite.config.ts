import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to https://jianhanlim.github.io/retire-plan/
export default defineConfig({
  plugins: [react()],
  base: '/retire-plan/',
})
