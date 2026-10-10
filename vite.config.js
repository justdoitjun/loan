import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* GitHub Pages 프로젝트 사이트는 /저장소이름/ 아래에 올라간다. 로컬은 /. */
  base: process.env.VITE_BASE || '/',
})
