import { existsSync, readdirSync, readFileSync } from "node:fs";
import viteConfig from "./vite.config";

/**
 * Tests that check against the SB2 captures (too big for git, ~650 MB in E:/Projetos/bombtop-src/sb2-evidence/docs,
 * reached through the docs/sb2 junction) are left out where the junction is missing.
 */
function withoutSb2Evidence(dir: string): string[] {
  if (existsSync(new URL("../../docs/sb2", import.meta.url))) return [];
  const root = new URL(`${dir}/`, import.meta.url);
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter(file => file.endsWith(".ts") && readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8").includes("docs/sb2/"))
    .map(file => `${dir}/${file.replaceAll("\\", "/")}`);
}

// vitest bundles its own vite, whose config types differ from the app's: keep this a plain object.
export default { ...viteConfig, test: { exclude: ["**/node_modules/**", "**/dist/**", ...withoutSb2Evidence("test")] } };
