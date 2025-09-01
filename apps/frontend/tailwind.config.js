module.exports = {
    content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
    theme: {
      extend: {
        colors: {
          bg: "#0b0f19",
          panel: "#0f1523",
          panelAlt: "#121826",
          stroke: "#1f2a3b",
          muted: "#9aa4b2",
          accent: "#5eead4"
        },
        boxShadow: {
          soft: "0 8px 30px rgba(0,0,0,.25)",
          card: "0 4px 20px rgba(0,0,0,.18)"
        },
        borderRadius: {
          xl2: "1.25rem"
        },
      },
    },
    plugins: [],
  };
  