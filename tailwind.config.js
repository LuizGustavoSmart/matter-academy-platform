/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Legado (mantido p/ páginas ainda não migradas) ── */
        bg: '#000000',
        steel: '#434d5e',
        mist: '#d6deed',
        surface: '#0d0d0d',
        surface2: '#111111',
        hairline: '#1c1f26',

        /* ── Design system interno (semântico) ── */
        canvas: '#0b0c0e',
        panel: '#121317',
        'panel-2': '#171a1f',
        'panel-3': '#1e2229',
        line: '#262a32',
        'line-strong': '#363c46',
        fg: '#f3f5f7',
        'fg-2': '#b4bcc8',
        'fg-3': '#868f9c',
        'fg-disabled': '#5b626d',
        lime: { DEFAULT: '#cbfb00', 500: '#cbfb00', hover: '#d6ff2b', press: '#b0dc00' },
        brand: { DEFAULT: '#cbfb00', hover: '#d6ff2b', press: '#b0dc00', ink: '#0b0c0e' },
        ok: '#6ebf4d',
        warn: '#f2b441',
        danger: '#e0523c',
        info: '#4e7dc4',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'ma-1': '0 1px 2px rgba(0,0,0,0.32)',
        'ma-2': '0 4px 12px rgba(0,0,0,0.36), 0 1px 2px rgba(0,0,0,0.28)',
        'ma-3': '0 12px 32px rgba(0,0,0,0.46), 0 2px 6px rgba(0,0,0,0.3)',
      },
      transitionTimingFunction: {
        ma: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'ma-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
