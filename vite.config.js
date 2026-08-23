import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Central de Cuidados",
        short_name: "Cuidados",
        description: "Consultas, medicamentos, lembretes, gastos e histórico.",
        theme_color: "#6747e8",
        background_color: "#f7f8fc",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
          { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
          { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ]
      }
    })
  ]
});
