import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        accent: {
          50:  '#fff7ed',
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
        sand: {
          50:  '#fdfbf7',
          100: '#f5f0e8',
          200: '#e8dfd0',
          300: '#d8ccb8',
          400: '#c2b49a',
          500: '#a9997e',
          600: '#8c7d64',
          700: '#6e624f',
          800: '#53493c',
          900: '#3a332b',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:         '0 2px 8px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 28px rgba(0,0,0,0.14)',
        soft:         '0 1px 4px rgba(0,0,0,0.05)',
        elevated:     '0 12px 40px rgba(0,0,0,0.18)',
      },
      borderRadius: {
        xl:    '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
