import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Chronicle AI Dark Fantasy Design System (UI 2.0)
        //
        // Repaint of the Phase 15 GBA-gold palette into a warmer,
        // heavier dark-fantasy register (Darkest Dungeon / Octopath
        // Traveler, not Golden Sun). Token NAMES and semantic ROLES are
        // preserved wherever the role is unchanged — `arcane` still means
        // "action available, never decorative" per the Style Guide's own
        // rule, just painted in fire/ember tones instead of amber-gold —
        // so every existing `bg-arcane-600`/`text-heal-400`/etc. class
        // string in the codebase keeps working, only its rendered color
        // changes. Two genuinely new roles get new tokens: `panel` (warm
        // carved-wood/stone surface, distinct from the cooler `void`
        // background) and `bronze` (the heavy border/frame family). A
        // narrow blue magic accent gets a new name (`mystic`) rather than
        // colliding with arcane's established meaning.

        // Background — nearly-black navy/charcoal/slate
        void: {
          50:  '#f5f0ea',
          100: '#e4dcd0',
          200: '#c9beb0',
          300: '#9c9086',
          400: '#6b625a',
          500: '#4a423c',
          600: '#322c28',
          700: '#1b1a1e',  // dark slate
          800: '#141315',  // charcoal stone
          900: '#101014',
          950: '#0a0a0f',  // nearly-black navy — page background
        },
        // Panel surfaces — carved oak / worn stone (NEW: panels no
        // longer share `void`'s cool background hue)
        panel: {
          500: '#4a3a2c',
          600: '#3a2b20',
          700: '#2a201a',
          800: '#241a16',
          900: '#1f1814',  // default panel background
          950: '#170f0b',
        },
        // Border/frame family — heavy bronze, glowing gold corners (NEW)
        bronze: {
          200: '#f0d5a0',
          300: '#e2b562',  // highlight
          400: '#c89443',  // gold
          600: '#7a5630',  // bronze
          800: '#4a3423',  // dark bronze
          900: '#241810',
        },
        // Accent — fire/ember warmth (repainted; still "action available")
        arcane: {
          50:  '#fceedd',
          100: '#f9dcb8',
          200: '#f2c48c',
          300: '#e8a74a',  // fire gold — highlight tier
          400: '#d77a26',  // ember — primary accent/CTA text/XP
          500: '#c08a3a',
          600: '#a86932',  // copper — CTA bg / hover
          700: '#b45a1a',  // burnt orange — deeper border/bg tint
          800: '#7a3d14',
          900: '#4f280e',
          950: '#2b1608',
        },
        // Magic/spell accent — narrow use only, not a general CTA color (NEW)
        mystic: {
          400: '#5e83d7',
          600: '#3d5fae',
        },
        // Secondary — crystal teal / spirit blue (unchanged — system
        // feedback register, not part of the fire/bronze warmth pass)
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
          400: '#b33131',  // blood red
          600: '#7a1e1e',  // dark crimson
        },
        heal: {
          400: '#5ea85b',  // nature green
          600: '#3d7a3b',
        },
        // Warning — distinct from arcane. arcane means "action available or
        // important reward" (Style Guide semantic rule); warning means
        // "caution," a different signal. Folded into the fire family's
        // duller, darker register so it reads as related-but-distinct from
        // arcane's brighter ember/fire-gold CTA tones.
        warning: {
          400: '#a86932',
          600: '#7a4a1f',
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
        'arcane':  '0 0 20px rgba(215, 122, 38, 0.3), 0 0 40px rgba(215, 122, 38, 0.12)',
        'bronze':  '0 0 16px rgba(226, 181, 98, 0.3), 0 0 32px rgba(200, 148, 67, 0.12)',
        'spirit':  '0 0 20px rgba(59, 202, 192, 0.25), 0 0 40px rgba(59, 202, 192, 0.1)',
        'void':    '0 4px 32px rgba(10, 10, 15, 0.85)',
        // Warm-lighting recipe (Phase 15.1 lineage, UI 2.0 repaint): outer
        // drop shadow for depth + inset top highlight suggesting torchlight
        // falling on the panel from above. Panel primitives (globals.css /
        // pixel.css) build on this same idea with a fuller inner+outer+
        // highlight stack.
        'panel':   '0 2px 16px rgba(10, 10, 15, 0.6), inset 0 1px 0 rgba(226, 181, 98, 0.06)',
      },
      backgroundImage: {
        'void-gradient':    'linear-gradient(135deg, #0a0a0f 0%, #141315 50%, #1b1a1e 100%)',
        'panel-gradient':   'linear-gradient(135deg, #1f1814 0%, #241a16 55%, #2a201a 100%)',
        'bronze-gradient':  'linear-gradient(135deg, #4a3423 0%, #7a5630 55%, #c89443 100%)',
        'arcane-gradient':  'linear-gradient(135deg, #4f280e 0%, #a86932 55%, #d77a26 100%)',
        'spirit-gradient':  'linear-gradient(135deg, #092c2d 0%, #1a4a49 50%, #19706d 100%)',
        'panel-border':     'linear-gradient(135deg, rgba(226,181,98,0.35) 0%, rgba(215,122,38,0.15) 100%)',
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
