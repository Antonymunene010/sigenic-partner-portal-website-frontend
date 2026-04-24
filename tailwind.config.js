/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: {
          DEFAULT: '#FAFAF7',
          dark: '#0B0C0E',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#111317',
        },
        raised: {
          DEFAULT: '#F4F3EE',
          dark: '#161920',
        },
        // Text
        ink: {
          DEFAULT: '#0A0A0A',
          dark: '#F5F5F2',
        },
        muted: {
          DEFAULT: '#6B6B6B',
          dark: '#8B8F97',
        },
        faint: {
          DEFAULT: '#A8A8A3',
          dark: '#5A5F68',
        },
        // Borders
        line: {
          DEFAULT: '#E7E5DF',
          dark: '#22262E',
        },
        'line-strong': {
          DEFAULT: '#D4D2CA',
          dark: '#2F333C',
        },
        // Accent — electric lime
        accent: {
          DEFAULT: '#CCFF00',
          dim: '#A8D400',
          ink: '#0A0A0A', // text color on accent bg
        },
        // Semantic
        success: '#10B981',
        warn: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.04em' }],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      backgroundImage: {
        'accent-glow': 'radial-gradient(circle, #CCFF00 0%, transparent 60%)',
      },
      boxShadow: {
        hairline: '0 0 0 1px rgba(10,10,10,0.06)',
        'hairline-dark': '0 0 0 1px rgba(255,255,255,0.06)',
        soft: '0 1px 2px rgba(10,10,10,0.04), 0 2px 8px rgba(10,10,10,0.04)',
        lift: '0 4px 12px rgba(10,10,10,0.06), 0 1px 2px rgba(10,10,10,0.04)',
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
