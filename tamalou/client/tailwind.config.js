/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B2A21',
        cream: '#FFF6E0',
        banana: '#FFD23F',
        gold: '#F5B700',
        jungle: { 950: '#0B2E1E', 900: '#0E3B26', 800: '#145234', 700: '#1A6B43', 500: '#2A9D3F', 300: '#7BCB6B' },
        hibiscus: '#E63946',
        mango: '#F77F00',
        lagoon: '#0E7C86',
        turquoise: '#2EC4B6',
      },
      fontFamily: {
        display: ['"Lilita One"', '"Arial Rounded MT Bold"', '"Trebuchet MS"', 'sans-serif'],
        body: ['Nunito', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { toy: '0 4px 0 #1B2A21', 'toy-sm': '0 2px 0 #1B2A21' },
    },
  },
  plugins: [],
};
