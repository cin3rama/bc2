/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable dark mode based on a class
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FFD700',   // Gold
          light: '#FFE066',     // Slightly lighter for hover, etc.
          dark: '#8B770C',      // Deep gold (was 'darkgold')
        },
        accent: {
          DEFAULT: '#FFC300',   // Electric yellow
          light: '#FFD966', // Lighter electric yellow
          dark: '#B28704',
        },
        neutral: {
          900: '#000000',       // Black
          800: '#1A1A1A',       // Cool gray
          500: '#6c6c6c',       // Medium gray
          100: '#F3F3F3',       // Light gray
          50: '#FFFFFF',        // White
        },
        secondary: {
          // DEFAULT: '#374151',
          DEFAULT: '#FFFFFF',
          dark: '#1F2937',
        },
        success: {
          DEFAULT: '#4CAF50',   // Green-light (Material success)
          dark: '#388E3C',      // Green-dark
        },
        error: {
          DEFAULT: '#FF4C4C',   // Red-light
          dark: '#D32F2F',      // Red-dark
        },
        surface: {
          DEFAULT: '#F3F3F3',   // Backgrounds
          dark: '#111827',
        },
        text: {
          DEFAULT: '#000000',
          inverted: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
