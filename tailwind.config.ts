import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Archivo for everything you read; Anton (the app's poster face) only
        // for page titles and the numbers a coach scans.
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        heading: ['Archivo', 'system-ui', 'sans-serif'],
        display: ['Anton', 'Impact', 'sans-serif'],
        poster: ['Anton', 'Impact', 'sans-serif'],
        brand: ['EdoSZ', 'Anton', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        input: 'hsl(var(--input))',
        field: 'hsl(var(--field))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        faint: 'hsl(var(--faint))',
        rail: 'hsl(var(--rail))',
        // Weight-plate colours, used only for nutrition data and day types,
        // always next to a label or icon.
        protein: 'hsl(var(--protein))',
        carbs: 'hsl(var(--carbs))',
        fat: 'hsl(var(--fat))',
        training: 'hsl(var(--training))',
        rest: 'hsl(var(--rest))',
      },
      borderRadius: {
        '2xl': '12px',
        xl: '10px',
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up .2s ease-out',
      },
    },
  },
  plugins: [
    animate,
    // `poster:` (the only look now) is kept so older class lists still apply;
    // `legacy:` matches nothing since the Clásico style was retired.
    plugin(({ addVariant }) => {
      addVariant('poster', ':is([data-design="poster"] &)');
      addVariant('legacy', ':is([data-design="legacy"] &)');
    }),
  ],
} satisfies Config;
