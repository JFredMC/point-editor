// GitHub Pages: serve index.html for unknown paths and skip Jekyll processing.
import { copyFileSync, writeFileSync } from 'node:fs';
const out = new URL('../dist/point-editor/browser/', import.meta.url).pathname;
copyFileSync(out + 'index.html', out + '404.html');
writeFileSync(out + '.nojekyll', '');
