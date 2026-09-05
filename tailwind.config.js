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
        // UTM-inspired identity: official violet/beige anchors and live-site interaction violet.
        brand: {
          50: '#f5f3fa',
          100: '#eae5f3',
          200: '#d5cbe6',
          300: '#b39fd4',
          400: '#8c70bc',
          500: '#7b55ad',
          600: '#6f3ba2',
          700: '#48247b',
          800: '#250e62',
          900: '#1b084b',
          950: '#10032e',
        },
        accent: {
          50: '#fbf8f5',
          100: '#f5eee8',
          200: '#e8d9cd',
          300: '#d3bba8',
          400: '#c19e84',
          500: '#a97f61',
          600: '#8e6447',
          700: '#704b35',
          800: '#573a2b',
          900: '#452f24',
          950: '#281910',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(37,14,98,0.04), 0 8px 24px -8px rgba(37,14,98,0.10)',
        lift: '0 2px 4px rgba(37,14,98,0.06), 0 20px 40px -16px rgba(37,14,98,0.18)',
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
