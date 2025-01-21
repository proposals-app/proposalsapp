import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: ['./shadcn/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          350: '#BDBDBD',
          400: '#A3A3A3',
          450: '#909090',
          500: '#737373',
          550: '#636363',
          600: '#525252',
          650: '#4B4B4B',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0A0A0A',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;

export default config;
