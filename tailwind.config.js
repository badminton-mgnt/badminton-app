/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#43A047',
          500: '#43A047',
          600: '#2E7D32',
        },
        success: {
          50: '#DCFCE7',
          700: '#166534',
        },
        warning: {
          50: '#FEF3C7',
          900: '#92400E',
        },
        error: {
          50: '#FEE2E2',
          800: '#B91C1C',
        },
        neutral: {
          400: '#6B7280',
          100: '#F9FAFB',
          200: '#E5E7EB',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
}
