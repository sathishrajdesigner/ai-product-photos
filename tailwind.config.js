/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      colors: {
        iyd: {
          black: '#111110',
          white: '#fafaf8',
          surface: '#f5f5f3',
          border: '#e6e6e3',
          muted: '#999994',
          accent: '#1d4ed8',
          'accent-light': '#eff6ff',
        }
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      }
    }
  },
  plugins: []
}
