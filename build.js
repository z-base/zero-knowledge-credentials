import { build } from "esbuild";

build({
  entryPoints: ["./dist/index.js"],
  outfile: "./test.js",
  bundle: true,
  external: ["node:*"],
  platform: "browser",
  format: "esm",
});
