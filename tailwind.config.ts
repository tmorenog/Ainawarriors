import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f1f7ee',
          100: '#dceacf',
          300: '#92b97e',
          500: '#4f7a45',
          700: '#2c4a2a',
          900: '#15241a',
        },
        moss: '#5a7d4f',
        bark: '#3b2a1c',
        bone: '#f5efe2',
        thunder: '#b65a2a',
        river: '#3a78a8',
        shadow: '#2b2030',
        wind: '#cdb673',
      },
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pulseSoft: {
          '0%,100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
