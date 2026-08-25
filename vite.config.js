import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is '/foodtech-vc-dashboard/' in production so assets resolve under
// GitHub Pages project URL (qotov.github.io/foodtech-vc-dashboard/), and '/'
// in dev so `npm run dev` still serves from the root.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/foodtech-vc-dashboard/' : '/',
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Single vendor chunk: splitting react/recharts/maps into separate
        // chunks broke module init order in production (React.createContext
        // undefined inside the maps chunk). One vendor chunk is order-safe
        // and still separates app code + data for caching.
        manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
      },
    },
  },
}));
