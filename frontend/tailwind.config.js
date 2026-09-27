module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "var(--ink-soft)",
          line: "#273240",
        },
        canvas: "var(--canvas)",
        brand: {
          50: "rgb(var(--brand-soft-rgb) / <alpha-value>)", 100: "#C6E2DC",
          400: "rgb(var(--brand-light-rgb) / <alpha-value>)",
          500: "rgb(var(--brand-rgb) / <alpha-value>)",
          600: "rgb(var(--brand-strong-rgb) / <alpha-value>)", 700: "#073A32",
        },
        amber: {
          400: "#EBB349",
          500: "rgb(var(--amber-rgb) / <alpha-value>)",
          600: "#C1862A",
        },
        line: "var(--line)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        head: ["Archivo", "'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        card: "var(--elevation-1)",
      },
    },
  },
  plugins: [],
};
