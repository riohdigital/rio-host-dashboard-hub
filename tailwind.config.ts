
import type { Config } from "tailwindcss";

// Cores vêm de src/styles/tokens.css (canais HSL). Aqui só ligamos cada
// token a um nome de classe, com suporte a opacidade (bg-brand/10).
const token = (nome: string) => `hsl(var(--${nome}) / <alpha-value>)`;
const TONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const escala = (nome: string, extras: Record<string, string> = {}) => ({
	DEFAULT: token(nome),
	foreground: token(`${nome}-foreground`),
	...Object.fromEntries(TONS.map((t) => [t, token(`${nome}-${t}`)])),
	...extras,
});

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx,js,jsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				brand: escala('brand', {
					hover: token('brand-hover'),
					accent: token('brand-accent'),
					'accent-foreground': token('brand-accent-foreground'),
				}),
				success: escala('success'),
				warning: escala('warning'),
				danger: escala('danger'),
				info: escala('info'),
				gray: Object.fromEntries(TONS.map((t) => [t, token(`gray-${t}`)])),
				surface: token('surface'),
				ink: token('ink'),
				airbnb: token('airbnb'),
				booking: { DEFAULT: token('booking'), light: token('booking-light') },
				direct: token('direct'),
				vrbo: token('vrbo'),
				expedia: token('expedia'),
				chart: {
					1: token('chart-1'),
					2: token('chart-2'),
					3: token('chart-3'),
					4: token('chart-4'),
					5: token('chart-5'),
					6: token('chart-6'),
					grid: token('chart-grid'),
					axis: token('chart-axis'),
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-secondary': 'var(--gradient-secondary)',
				'gradient-accent': 'var(--gradient-accent)',
				'gradient-muted': 'var(--gradient-muted)',
				'gradient-hover': 'var(--gradient-hover)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(4px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.9)', opacity: '0' },
					'50%': { transform: 'scale(1.05)' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'slide-in-right': {
					'0%': { 
						transform: 'translateX(100%) scale(0.95)',
						opacity: '0'
					},
					'100%': { 
						transform: 'translateX(0) scale(1)',
						opacity: '1'
					}
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '1', transform: 'scale(1)' },
					'50%': { opacity: '0.95', transform: 'scale(1.02)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.4s ease-out',
				'scale-in': 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
				'slide-in-right': 'slide-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
				'pulse-soft': 'pulse-soft 3s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
