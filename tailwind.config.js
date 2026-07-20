/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // editorial ink/paper scale — used via CSS vars for theme switching
        ink: {
          950: '#0a0c10',
          900: '#0f1218',
          850: '#151922',
          800: '#1b2029',
          700: '#252c38',
          600: '#333c4c',
          500: '#4a5568',
          400: '#6b7688',
          300: '#94a0b2',
          200: '#c3ccd8',
          100: '#e6ebf1',
          50: '#f4f6f9',
        },
        // categorical palette (segments) — tuned for dark ground, colorblind-aware
        seg: {
          1: '#4cc9b0', 2: '#f6a24a', 3: '#7aa2f7', 4: '#e06c9f',
          5: '#b58cf0', 6: '#e5c454', 7: '#5fb3e0', 8: '#8fce6b',
          9: '#ef7d6a', 10: '#3fb0a3', 11: '#c98bbb',
        },
        accent: '#4cc9b0',
      },
    },
  },
  plugins: [],
};
