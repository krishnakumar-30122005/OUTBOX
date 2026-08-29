/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f3ff',
          100: '#e1e7ff',
          200: '#c8d4ff',
          300: '#a2b7ff',
          400: '#7390ff',
          500: '#4361ff', // Premium ReachInbox Purple/Blue
          600: '#2b3ff5',
          700: '#1e2be2',
          800: '#1b24b7',
          900: '#1b2391',
        },
      },
    },
  },
  plugins: [],
}
