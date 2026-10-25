import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { VitePWA } from "vite-plugin-pwa";

/** The commit being built (Render sets RENDER_GIT_COMMIT), shown in the menu. */
function appVersion(): string {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  server: {
    // Lets a phone reach the dev build through a tunnel (ngrok) on a single origin:
    // the game server is proxied under /colyseus (set VITE_SERVER_URL=/colyseus).
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app"],
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // In dev the service worker only runs for phone testing (PWA_DEV=1, so the tunnel build can be
      // installed): elsewhere it would keep serving stale pages after every change.
      devOptions: { enabled: process.env.PWA_DEV === "1" },
      includeAssets: ["icons/favicon-64.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Bombtop",
        short_name: "Bombtop",
        description: "Batalha de bombas multiplayer no navegador, até 5 jogadores.",
        lang: "pt-BR",
        theme_color: "#14142b",
        background_color: "#14142b",
        display: "fullscreen",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Pixi chunks are large; precache everything the game needs (code, art, sounds) for fast starts.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,m4a}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
