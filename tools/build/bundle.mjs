// Stitch src/*.js into the one file people install: youtube-embed-enhancer.user.js.
// Rollup (not esbuild) because it keeps every comment and doesn't minify our code.
// The Mediabunny chunk is already minified by tools/mediabunny/build.mjs — that's
// fine, it's a vendored library, not our code.

import { rollup } from 'rollup';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const banner = readFileSync(resolve(root, 'src/_banner.txt'), 'utf8').trimEnd();
const outFile = resolve(root, 'youtube-embed-enhancer.user.js');

const bundle = await rollup({
  input: resolve(root, 'src/main.js'),
  treeshake: false, // keep the source as written
  onwarn(w, warn) {
    // one IIFE, everything shares scope — circular-ish import notices are noise
    if (w.code === 'CIRCULAR_DEPENDENCY') return;
    warn(w);
  },
});

await bundle.write({
  file: outFile,
  format: 'iife',
  banner,
  esModule: false,
  freeze: false,
  generatedCode: { constBindings: true },
  indent: '  ',
});
await bundle.close();

const kb = Math.round(readFileSync(outFile).length / 1024);
console.log(`built youtube-embed-enhancer.user.js (${kb} KB)`);
