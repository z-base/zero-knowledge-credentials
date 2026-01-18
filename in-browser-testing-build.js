import { build } from "esbuild";

build({
  entryPoints: ["./src/index.ts"],
  outfile: "./index.js",
  bundle: true,
  external: ["node:*"],
  platform: "browser",
  format: "esm",
});
