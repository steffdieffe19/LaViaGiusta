/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1b4332',      // Deep forest green
          light: '#2d6a4f',        // Sage green
          dark: '#081c15',         // Darkest pine green
        },
        accent: {
          DEFAULT: '#ff6b35',      // High-visibility safety orange for alerts/SOS
        },
        darkbg: {
          DEFAULT: '#121212',      // Dark theme background
          card: '#1e1e1e',         // Card color
          border: '#2c2c2c',       // Borders
        }
      }
    },
  },
  plugins: [],
}
