/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
  	extend: {
  		animation: {
  			"konami-heart-fill": "konami-heart-fill 240ms ease-out both",
  			"konami-hearts-fade": "konami-hearts-fade 600ms ease-out forwards",
  			"konami-heart-disappear": "konami-heart-disappear 120ms ease-out forwards",
  			"konami-contra-run": "konami-contra-run 3240ms linear forwards",
  			"konami-contra-legs": "konami-contra-legs 3240ms linear forwards",
  			"konami-contra-bubble": "konami-contra-bubble 3240ms linear forwards",
  		},
  		keyframes: {
  			"konami-heart-fill": {
  				from: { opacity: "0" },
  				to: { opacity: "1" },
  			},
  			"konami-hearts-fade": {
  				from: { opacity: "1" },
  				to: { opacity: "0" },
  			},
  			"konami-heart-disappear": {
  				from: { opacity: "1", transform: "scale(1)" },
  				"50%": { opacity: "1", transform: "scale(1.15)" },
  				to: { opacity: "0", transform: "scale(0)" },
  			},
  			"konami-contra-run": {
  				"0%": { left: "-24px", transform: "translateY(-50%) rotate(0deg)" },
  				"8.7%": { left: "77px", transform: "translateY(-50%) rotate(0deg)" },
  				"9.6%": { left: "77px", transform: "translateY(-50%) rotate(-90deg)" },
  				"71.3%": { left: "77px", transform: "translateY(-50%) rotate(-90deg)" },
  				"74%": { left: "77px", transform: "translateY(-50%) rotate(-90deg) translateX(-2px)" },
  				"76%": { left: "77px", transform: "translateY(-50%) rotate(-90deg) translateX(2px)" },
  				"78%": { left: "77px", transform: "translateY(-50%) rotate(-90deg) translateX(-2px)" },
  				"80%": { left: "77px", transform: "translateY(-50%) rotate(-90deg) translateX(2px)" },
  				"82%": { left: "77px", transform: "translateY(-50%) rotate(-90deg) translateX(0px)" },
  				"83.6%": { left: "77px", transform: "translateY(-50%) rotate(-90deg)" },
  				"86.7%": { left: "77px", transform: "translateY(-50%) rotate(0deg)" },
  				"100%": { left: "100%", transform: "translateY(-50%) rotate(0deg)" },
  			},
  			"konami-contra-legs": {
  				"0%": { transform: "translateY(0)" },
  				"4.4%": { transform: "translateY(2px)" },
  				"8.7%": { transform: "translateY(0)" },
  				"86.7%, 90%, 93%, 96%, 100%": { transform: "translateY(0)" },
  				"88%, 91%, 94%, 98%": { transform: "translateY(2px)" },
  			},
  			"konami-contra-bubble": {
  				"0%, 40.5%": { opacity: "0", visibility: "hidden", transform: "translateX(-50%)" },
  				"41%": { opacity: "1", visibility: "visible", transform: "translateX(-50%) rotate(90deg)" },
  				"86.5%": { opacity: "1", visibility: "visible", transform: "translateX(-50%) rotate(90deg)" },
  				"86.7%, 100%": { opacity: "0", visibility: "hidden", transform: "translateX(-50%)" },
  			},
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS config file
  plugins: [require("tailwindcss-animate")],
};
