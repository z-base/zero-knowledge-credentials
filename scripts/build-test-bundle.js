import { mkdir } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const outDir = path.resolve("tests", "fixtures");
const outFile = path.join(outDir, "zkcredentials.bundle.js");

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["./src/index.ts"],
  outfile: outFile,
  bundle: true,
  external: ["node:*"],
  platform: "browser",
  format: "iife",
  target: "es2022",
  globalName: "ZKCredentialsBundle",
});
