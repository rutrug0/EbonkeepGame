import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep large generated data files in their own cacheable chunks
          if (id.includes("/src/generated/itemEncyclopediaData")) {
            return "data-encyclopedia";
          }
          if (id.includes("/src/generated/itemArtManifest")) {
            return "data-art-manifest";
          }
          if (id.includes("/src/generated/")) {
            return "data-generated";
          }
          // i18n — clean split, no cross-deps with other vendor libs
          if (id.includes("node_modules/i18next") || id.includes("node_modules/react-i18next")) {
            return "vendor-i18n";
          }
          // Everything else in node_modules (react + react-dom + recharts + d3 share deps)
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        }
      }
    }
  }
});
