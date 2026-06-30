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
        dark: {
          950: '#070a13',
          900: '#0f1322',
          800: '#1d243b',
          700: '#2c375b',
          600: '#3e4c7a',
        },
        brand: {
          50: '#f0f3ff',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
