import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Terminal 3 deep-navy system (never pure black).
        navy: {
          950: "#050A18",
          900: "#091230",
          850: "#0C1838",
          800: "#101F45",
          700: "#172B58",
          600: "#21396E",
        },
        // Restrained red for halt/error — lives in the same glass system.
        halt: {
          300: "#FFB0BC",
          400: "#FF8193",
          500: "#F25A6F",
        },
        mist: "#EAF2FB",
        // Legacy tokens remapped to navy so existing components inherit the look.
        ink: "#050A18",
        panel: "#0C1838",
        edge: "#1d2b50",
      },
      // Extra opacity steps so `/8 /12 /15 /35` resolve in className AND @apply
      // (the default scale jumps 5→10→20; these keep the glass borders subtle).
      opacity: {
        8: "0.08",
        12: "0.12",
        15: "0.15",
        35: "0.35",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Satoshi"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sky-in": {
          "0%": { opacity: "0", transform: "translateY(6px)", boxShadow: "0 0 0 0 rgba(56,189,248,0.0)" },
          "30%": { boxShadow: "0 0 0 1px rgba(56,189,248,0.45), 0 0 26px -6px rgba(56,189,248,0.6)" },
          "100%": { opacity: "1", transform: "translateY(0)", boxShadow: "0 0 0 0 rgba(56,189,248,0.0)" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        "sky-in": "sky-in 1.2s ease-out both",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
