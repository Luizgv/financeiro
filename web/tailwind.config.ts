import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        card: "var(--card)",
        elevated: "var(--card-elevated)",
        border: "var(--border)",
        input: "var(--input)",
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          hover: "var(--accent-hover)",
        },
        success: {
          DEFAULT: "var(--success)",
          subtle: "var(--success-subtle)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          subtle: "var(--warning-subtle)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          subtle: "var(--danger-subtle)",
        },
        sidebar: "var(--sidebar)",
      },
      boxShadow: {
        "card-dark":
          "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0,0,0,0.55)",
        "accent-glow": "0 8px 28px -6px rgba(99, 102, 241, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
