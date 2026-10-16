/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          950: '#07090e',
          900: '#0c0f17',
          850: '#111522',
          800: '#171c2d',
          750: '#1e2439',
          700: '#252d47',
          600: '#353f63',
          500: '#4e5b8a',
          400: '#7584b4',
          300: '#a3b0d6',
          200: '#cbd4ed',
          100: '#eef2fc',
          50: '#f8fafc',
        },
        horror: {
          crimson: '#e11d48',
          blood: '#991b1b',
          ember: '#ea580c',
          toxic: '#16a34a',
          void: '#030712',
          mist: '#64748b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
