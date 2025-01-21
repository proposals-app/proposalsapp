import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: ['./shadcn/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        for: {
          400: 'var(--for-400)',
          600: 'var(--for-600)',
        },
        abstain: {
          400: 'var(--abstain-400)',
          600: 'var(--abstain-600)',
        },
        against: {
          400: 'var(--against-400)',
          600: 'var(--against-600)',
        },
        neutral: {
          50: 'var(--neutral-50)',
          100: 'var(--neutral-100)',
          200: 'var(--neutral-200)',
          300: 'var(--neutral-300)',
          350: 'var(--neutral-350)',
          400: 'var(--neutral-400)',
          450: 'var(--neutral-450)',
          500: 'var(--neutral-500)',
          550: 'var(--neutral-550)',
          600: 'var(--neutral-600)',
          650: 'var(--neutral-650)',
          700: 'var(--neutral-700)',
          800: 'var(--neutral-800)',
          900: 'var(--neutral-900)',
          950: 'var(--neutral-950)',
        },
        brand: {
          accent: 'var(--brand-accent)',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;

export default config;
