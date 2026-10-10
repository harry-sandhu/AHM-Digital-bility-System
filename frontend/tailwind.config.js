module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f5fa",
          100: "#dbe7f1",
          200: "#b3cce0",
          300: "#80a9c9",
          400: "#4d7fa8",
          500: "#2f5f87",
          600: "#204768",
          700: "#1a3a54",
          800: "#152d42",
          900: "#101f2e",
          950: "#0a151f",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffead1",
          200: "#fed0a3",
          300: "#feb169",
          400: "#fc8d33",
          500: "#f5720f",
          600: "#d8590a",
          700: "#b2440a",
          800: "#8f3710",
          900: "#762f10",
        },
        danger: {
          50: "#fef2f2",
          100: "#fde3e3",
          500: "#dc3b3b",
          600: "#c22b2b",
          700: "#9e2222",
        },
        success: {
          50: "#f0fbf4",
          100: "#d9f5e3",
          500: "#1f9d5c",
          600: "#17824c",
          700: "#13663c",
        },
      },
      fontFamily: {
        display: ["\"Oswald\"", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "display-md": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-sm": ["1.5rem", { lineHeight: "1.2" }],
      },
      borderRadius: {
        card: "20px",
        pill: "999px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(16, 31, 46, 0.06), 0 12px 32px -12px rgba(16, 31, 46, 0.18)",
        "panel-lg": "0 2px 4px rgba(16, 31, 46, 0.08), 0 24px 48px -16px rgba(16, 31, 46, 0.22)",
      },
    },
  },
  plugins: [],
}
