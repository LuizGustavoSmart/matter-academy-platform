/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Legado (mantido p/ páginas ainda não migradas) ── */
        bg: 'rgb(var(--ma-canvas-rgb) / <alpha-value>)',
        steel: 'rgb(var(--ma-fg-3-rgb) / <alpha-value>)',
        mist: 'rgb(var(--ma-fg-2-rgb) / <alpha-value>)',
        surface: 'rgb(var(--ma-panel-rgb) / <alpha-value>)',
        surface2: 'rgb(var(--ma-panel-2-rgb) / <alpha-value>)',
        hairline: 'rgb(var(--ma-line-rgb) / <alpha-value>)',

        /* ── Design system interno (semântico) ── */
        canvas: 'rgb(var(--ma-canvas-rgb) / <alpha-value>)',
        panel: 'rgb(var(--ma-panel-rgb) / <alpha-value>)',
        'panel-2': 'rgb(var(--ma-panel-2-rgb) / <alpha-value>)',
        'panel-3': 'rgb(var(--ma-panel-3-rgb) / <alpha-value>)',
        line: 'rgb(var(--ma-line-rgb) / <alpha-value>)',
        'line-strong': 'rgb(var(--ma-line-strong-rgb) / <alpha-value>)',
        fg: 'rgb(var(--ma-fg-rgb) / <alpha-value>)',
        'fg-2': 'rgb(var(--ma-fg-2-rgb) / <alpha-value>)',
        'fg-3': 'rgb(var(--ma-fg-3-rgb) / <alpha-value>)',
        'fg-disabled': 'rgb(var(--ma-fg-disabled-rgb) / <alpha-value>)',
        lime: { DEFAULT: 'rgb(var(--ma-brand-rgb) / <alpha-value>)', 500: 'rgb(var(--ma-brand-rgb) / <alpha-value>)', hover: 'rgb(var(--ma-brand-hover-rgb) / <alpha-value>)', press: 'rgb(var(--ma-brand-press-rgb) / <alpha-value>)' },
        brand: { DEFAULT: 'rgb(var(--ma-brand-rgb) / <alpha-value>)', hover: 'rgb(var(--ma-brand-hover-rgb) / <alpha-value>)', press: 'rgb(var(--ma-brand-press-rgb) / <alpha-value>)', ink: 'rgb(var(--ma-brand-ink-rgb) / <alpha-value>)' },
        ok: 'rgb(var(--ma-ok-rgb) / <alpha-value>)',
        warn: 'rgb(var(--ma-warn-rgb) / <alpha-value>)',
        danger: 'rgb(var(--ma-danger-rgb) / <alpha-value>)',
        info: 'rgb(var(--ma-info-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        'ma-1': 'var(--ma-shadow-1)',
        'ma-2': 'var(--ma-shadow-2)',
        'ma-3': 'var(--ma-shadow-3)',
        'ma-ring': 'var(--ma-ring)',
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
