/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f3f3f3',
          dark: '#202020',
        },
        accent: {
          DEFAULT: '#0067c0',
          hover: '#1a75c7',
        },
      },
    },
  },
  plugins: [],
}
