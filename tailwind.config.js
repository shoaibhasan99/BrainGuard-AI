/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'hologram': 'hologram 3s ease-in-out infinite',
        'energy-flow': 'energy-flow 3s ease-in-out infinite',
        'neural-pulse': 'neural-pulse 2s ease-in-out infinite',
        'quantum-spin': 'quantum-spin 4s linear infinite',
        'data-stream': 'data-stream 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(5deg)' },
        },
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
            transform: 'scale(1)',
          },
          '50%': {
            boxShadow: '0 0 40px rgba(6, 182, 212, 0.8)',
            transform: 'scale(1.05)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        hologram: {
          '0%, 100%': {
            opacity: '0.8',
            transform: 'translateY(0px) rotateX(0deg)',
          },
          '50%': {
            opacity: '1',
            transform: 'translateY(-10px) rotateX(5deg)',
          },
        },
        'energy-flow': {
          '0%': {
            transform: 'translateX(-100%) scaleX(0)',
            opacity: '0',
          },
          '50%': {
            opacity: '1',
          },
          '100%': {
            transform: 'translateX(100%) scaleX(1)',
            opacity: '0',
          },
        },
        'neural-pulse': {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: '0.6',
          },
          '50%': {
            transform: 'scale(1.2)',
            opacity: '1',
          },
        },
        'quantum-spin': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(90deg) scale(1.1)' },
          '50%': { transform: 'rotate(180deg) scale(1)' },
          '75%': { transform: 'rotate(270deg) scale(1.1)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        'data-stream': {
          '0%': {
            transform: 'translateY(-100%) rotate(0deg)',
            opacity: '0',
          },
          '50%': {
            opacity: '1',
          },
          '100%': {
            transform: 'translateY(100%) rotate(360deg)',
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [],
}

