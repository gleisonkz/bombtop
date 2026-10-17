import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/favicon-64.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Bombtopia",
        short_name: "Bombtopia",
        description: "Batalha de bombas multiplayer no navegador, até 5 jogadores.",
        lang: "pt-BR",
        theme_color: "#1b1b2f",
        background_color: "#1b1b2f",
        display: "fullscreen",
        orientation: "landscape",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Pixi chunks are large; precache everything the game needs to start offline (local mode).
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
