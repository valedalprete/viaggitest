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
          50:  '#eefbff',
          100: '#d9f4ff',
          200: '#b7eaff',
          300: '#84dcff',
          400: '#4cc5fb',
          500: '#26a7ef',
          600: '#1388ce',
          700: '#106aa3',
          800: '#15567f',
          900: '#194868',
        },
        accent: {
          50:  '#f7f4ff',
          100: '#eee8ff',
          200: '#ddd0ff',
          300: '#c5adff',
          400: '#a980ff',
          500: '#8d5cf8',
          600: '#7442db',
          700: '#5d35b0',
          800: '#4a2d87',
          900: '#3d276b',
        },
        sand: {
          50:  '#ffffff',
          100: '#f8fafc',
          200: '#eef2f7',
          300: '#e2e8f0',
          400: '#cdd6e3',
          500: '#95a3b8',
          600: '#71839b',
          700: '#53657d',
          800: '#3a4a60',
          900: '#27374c',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', '"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:         '0 6px 18px rgba(17, 44, 78, 0.08)',
        'card-hover': '0 14px 36px rgba(17, 44, 78, 0.14)',
        soft:         '0 1px 4px rgba(0,0,0,0.05)',
        elevated:     '0 16px 42px rgba(17, 44, 78, 0.18)',
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
