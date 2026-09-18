module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#111820", soft: "#1B242F", line: "#273240" },
        canvas: "#F3F5F7",
        brand: { 50: "#E7F2EF", 100: "#C6E2DC", 400: "#2C8474", 500: "#0B5C4E", 600: "#094A3F", 700: "#073A32" },
        amber: { 400: "#EBB349", 500: "#E0A33E", 600: "#C1862A" },
        line: "#E3E7EB",
        muted: "#69747F",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        head: ["Archivo", "'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,32,.06), 0 8px 24px -16px rgba(17,24,32,.18)",
      },
    },
  },
  plugins: [],
};
