import { build } from 'esbuild'

build({
  entryPoints: ['./in-browser-testing-libs.js'],
  outfile: './in-browser-testing.js',
  bundle: true,
  external: ['node:*'],
  platform: 'browser',
  format: 'esm',
})
