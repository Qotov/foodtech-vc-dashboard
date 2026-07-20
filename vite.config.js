import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is '/foodtech-vc-dashboard/' in production so assets resolve under
// GitHub Pages project URL (qotov.github.io/foodtech-vc-dashboard/), and '/'
// in dev so `npm run dev` still serves from the root.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/foodtech-vc-dashboard/' : '/',
  server: { port: 5173 },
}));
