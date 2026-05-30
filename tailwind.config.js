/** @type {import('tailwindcss').Config} */
// Palette follows the Sigenic PRD §11 design system: a 90/10 black-white-grey base
// with a single gold accent (#C8A75B) reserved for KPI numbers, primary CTAs,
// selected states and key insights.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — light: #FFFFFF / #F7F7F8 ; dark: #0E0E10 / #15161A / #1C1E24
        canvas: {
          DEFAULT: '#FFFFFF',
          dark: '#0E0E10',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#1C1E24',
        },
        raised: {
          DEFAULT: '#F7F7F8',
          dark: '#15161A',
        },
        // Text — primary / secondary / muted
        ink: {
          DEFAULT: '#0E0E10',
          dark: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#4B5563',
          dark: '#B3B3B3',
        },
        faint: {
          DEFAULT: '#9CA3AF',
          dark: '#6B7280',
        },
        // Borders / dividers
        line: {
          DEFAULT: '#E5E7EB',
          dark: '#2A2D34',
        },
        'line-strong': {
          DEFAULT: '#D1D5DB',
          dark: '#3A3E47',
        },
        // Primary accent — gold
        accent: {
          DEFAULT: '#C8A75B',
          dim: '#B8964A', // hover
          soft: '#F5EBD3', // soft background
          warm: '#E6C77A', // secondary warm highlight
          deep: '#9F7F3A', // deep gold (readable on light)
          ink: '#0E0E10', // text color on accent bg
        },
        // Emphasis — gold tuned for legibility on each surface (deep on light, warm on dark)
        emphasis: 'rgb(var(--emphasis) / <alpha-value>)',
        // Functional
        success: '#22C55E',
        warn: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.04em' }],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      backgroundImage: {
        'accent-glow': 'radial-gradient(circle, #C8A75B 0%, transparent 60%)',
        'gold-gradient': 'linear-gradient(135deg, #C8A75B, #E6C77A)',
      },
      boxShadow: {
        hairline: '0 0 0 1px rgba(14,14,16,0.06)',
        'hairline-dark': '0 0 0 1px rgba(255,255,255,0.06)',
        soft: '0 1px 2px rgba(14,14,16,0.04), 0 2px 8px rgba(14,14,16,0.04)',
        lift: '0 4px 12px rgba(14,14,16,0.06), 0 1px 2px rgba(14,14,16,0.04)',
        glow: '0 0 0 1px rgba(200,167,91,0.4), 0 6px 24px rgba(200,167,91,0.18)',
      },
      borderRadius: {
        xs: '3px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'fade-up': 'fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 300ms ease-out both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
