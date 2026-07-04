import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Chronicle AI JRPG Design System
        // Primary — deep void ink
        void: {
          50:  '#f0f0f5',
          100: '#dcdce8',
          200: '#b8b8d4',
          300: '#8a8ab6',
          400: '#5c5c98',
          500: '#3a3a7a',
          600: '#2e2e60',
          700: '#1e1e45',
          800: '#14142e',
          900: '#0a0a1a',
          950: '#050510',
        },
        // Accent — arcane amber / enchanted gold
        arcane: {
          50:  '#fefbec',
          100: '#fdf3c8',
          200: '#fae48d',
          300: '#f7cf4d',
          400: '#f4b820',
          500: '#e39a08',
          600: '#c27505',
          700: '#9a5208',
          800: '#7d410d',
          900: '#683611',
          950: '#3c1b05',
        },
        // Secondary — crystal teal / spirit blue
        spirit: {
          50:  '#edfcfa',
          100: '#d2f7f3',
          200: '#aaeee8',
          300: '#72e0d7',
          400: '#3bcac0',
          500: '#21afa6',
          600: '#198c87',
          700: '#19706d',
          800: '#1a5a58',
          900: '#1a4a49',
          950: '#092c2d',
        },
        // Status
        harm: {
          400: '#f87171',
          600: '#dc2626',
        },
        heal: {
          400: '#4ade80',
          600: '#16a34a',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
        lore: ['"Crimson Text"', 'Georgia', 'serif'],
        'pixel-display': ['"Press Start 2P"', '"Courier New"', 'monospace'],
        'pixel-body': ['"VT323"', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.625rem' }],
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],
        'xl':   ['1.25rem',  { lineHeight: '1.875rem' }],
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],
        '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':  ['3rem',     { lineHeight: '1' }],
        '6xl':  ['3.75rem',  { lineHeight: '1' }],
      },
      borderRadius: {
        'none':  '0',
        'sm':    '0.125rem',
        DEFAULT: '0.25rem',
        'md':    '0.375rem',
        'lg':    '0.5rem',
        'xl':    '0.75rem',
        '2xl':   '1rem',
        'full':  '9999px',
      },
      boxShadow: {
        'arcane':  '0 0 20px rgba(243, 207, 77, 0.25), 0 0 40px rgba(243, 207, 77, 0.1)',
        'spirit':  '0 0 20px rgba(59, 202, 192, 0.25), 0 0 40px rgba(59, 202, 192, 0.1)',
        'void':    '0 4px 32px rgba(5, 5, 16, 0.8)',
        'panel':   '0 2px 16px rgba(5, 5, 16, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'void-gradient':    'linear-gradient(135deg, #0a0a1a 0%, #14142e 50%, #1e1e45 100%)',
        'arcane-gradient':  'linear-gradient(135deg, #3c1b05 0%, #683611 50%, #9a5208 100%)',
        'spirit-gradient':  'linear-gradient(135deg, #092c2d 0%, #1a4a49 50%, #19706d 100%)',
        'panel-border':     'linear-gradient(135deg, rgba(243,207,77,0.3) 0%, rgba(59,202,192,0.15) 100%)',
      },
      animation: {
        'pulse-arcane': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker':      'flicker 3s ease-in-out infinite',
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.85' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
