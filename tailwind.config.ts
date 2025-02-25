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
        gold: '#FFD700',
        darkgold: '#8B770C',
        'gold-light': '#D4AF37',
        'electric-yellow': '#FFC300',
        'electric-yellow-light': '#FFD966',
        black: '#000000',
        'cool-gray': '#1A1A1A',
        'light-gray': '#F3F3F3',
        white: '#FFFFFF',
        'red-dark': '#D32F2F',
        'red-light': '#FF4C4C',
        'green-dark': '#388E3C',
        'green-light': '#4CAF50',
        primary: '#FFD700',
        'primary-dark': '#1A1A1A',
        accent: '#FFC300',
        'accent-dark': '#FFD966',
        text: '#000000',
        'text-dark': '#FFFFFF',
        secondary: '#F3F3F3',
        'secondary-dark': '#1A1A1A',
      },
    },
  },
  plugins: [],
};
