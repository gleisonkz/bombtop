import { existsSync, readdirSync, readFileSync } from "node:fs";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * The SB2 tests check the sim against captures that are too big for git (~650 MB): they live in
 * E:/Projetos/bombtop-src/sb2-evidence/docs, reached through the docs/sb2 junction. Without it they are left out.
 */
function withoutSb2Evidence(dir: string): string[] {
  if (existsSync(new URL("../../docs/sb2", import.meta.url))) return [];
  const root = new URL(`${dir}/`, import.meta.url);
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter(file => file.endsWith(".ts") && readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8").includes("docs/sb2/"))
    .map(file => `${dir}/${file.replaceAll("\\", "/")}`);
}

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, ...withoutSb2Evidence("test")] },
});
