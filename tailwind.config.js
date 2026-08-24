/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          50: '#f6f8fa',
          100: '#eceff3',
          200: '#d5dbe3',
          300: '#aeb8c6',
          400: '#7e8da1',
          500: '#5b6a80',
          600: '#46536a',
          700: '#374155',
          800: '#27303f',
          900: '#1a212c',
          950: '#0f141c',
        },
        brand: {
          50: '#eef9f6',
          100: '#d3f0e8',
          200: '#a8e0d2',
          300: '#73c9b6',
          400: '#43ab97',
          500: '#2a8d7b',
          600: '#1f7264',
          700: '#1b5b51',
          800: '#174841',
          900: '#133b36',
          950: '#0a221f',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,20,28,0.04), 0 8px 24px -8px rgba(15,20,28,0.10)',
        lift: '0 2px 4px rgba(15,20,28,0.06), 0 20px 40px -16px rgba(15,20,28,0.18)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'grow-bar': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'grow-bar': 'grow-bar 0.9s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
