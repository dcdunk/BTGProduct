import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        void: 'var(--bg-void)',
        base: 'var(--bg-base)',
        elevated: 'var(--bg-elevated)',
        'surface-hover': 'var(--bg-hover)',
        'surface-active': 'var(--bg-active)',
        cyan: {
          DEFAULT: 'var(--accent-cyan)',
          muted: 'var(--accent-cyan-muted)',
        },
        magenta: {
          DEFAULT: 'var(--accent-magenta)',
          muted: 'var(--accent-magenta-muted)',
        },
        neon: {
          green: 'var(--accent-green)',
          amber: 'var(--accent-amber)',
          purple: 'var(--accent-purple)',
        },
        'neon-green-muted': 'var(--accent-green-muted)',
        'neon-amber-muted': 'var(--accent-amber-muted)',
        'neon-purple-muted': 'var(--accent-purple-muted)',
        'provider-anthropic': 'var(--provider-anthropic)',
        'provider-openai': 'var(--provider-openai)',
        'provider-google': 'var(--provider-google)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        'on-accent': 'var(--text-on-accent)',
      },
      fontFamily: {
        display: ['var(--font-orbitron)', '"Orbitron"', 'sans-serif'],
        mono: ['var(--font-jetbrains)', '"JetBrains Mono"', 'monospace'],
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        default: 'var(--border-default)',
        accent: 'var(--border-accent)',
      },
      boxShadow: {
        'glow-cyan': 'var(--accent-cyan-glow)',
        'glow-magenta': 'var(--accent-magenta-glow)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        'glow-cyan-subtle': 'var(--shadow-glow-cyan)',
        'glow-magenta-subtle': 'var(--shadow-glow-magenta)',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.8125rem',
        base: '0.875rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1.5rem',
        '2xl': '2rem',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        full: '999px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', boxShadow: '0 0 8px var(--accent-cyan)' },
          '50%': { opacity: '1', boxShadow: '0 0 20px var(--accent-cyan)' },
        },
        'status-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--accent-green)' },
          '50%': { boxShadow: '0 0 0 4px var(--accent-green-muted)' },
        },
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.2s ease-in-out infinite',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'page-enter': 'page-enter 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
