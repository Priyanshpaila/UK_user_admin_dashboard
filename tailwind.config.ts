import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f10',
        surface: '#111827',
      },
    },
  },
  plugins: [],
};

export default config;
