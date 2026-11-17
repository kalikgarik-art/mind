/* Tailwind Play CDN configuration.
   Loaded with `defer` AFTER the CDN script so execution order is:
   cdn.tailwindcss.com  ->  this file  ->  page scripts. */
if (window.tailwind) {
  tailwind.config = {
    theme: {
      extend: {
        colors: { void: "#0a0a0c", coal: "#0e0e13", accent: "#8b5cf6", aqua: "#06b6d4" },
        fontFamily: {
          sans: ["Plus Jakarta Sans", "sans-serif"],
          mono: ["JetBrains Mono", "monospace"],
        },
      },
    },
  };
}
