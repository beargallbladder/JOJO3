import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gravity: {
          bg: '#0A0B10',
          surface: '#101318',
          elevated: '#171B24',
          border: '#1F2533',
          text: '#F0F2F5',
          'text-secondary': '#8B92A5',
          'text-whisper': '#4A5168',
          accent: '#6366F1',
          'accent-warm': '#A78BFA',
        },
        health: {
          recovery: '#34D399',
          teal: '#2DD4BF',
          coral: '#F97066',
          amber: '#FBBF24',
          indigo: '#6366F1',
          violet: '#A78BFA',
        },
        band: {
          escalated: '#F97066',
          monitor: '#FBBF24',
          suppressed: '#6366F1',
        },
        domain: {
          cardiovascular: '#F97066',
          metabolic: '#FBBF24',
          hormonal: '#A78BFA',
          musculoskeletal: '#2DD4BF',
          sleep_recovery: '#6366F1',
          cognitive: '#F472B6',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      animation: {
        'breathe': 'breathe 5s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.003)', opacity: '0.97' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.2)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
