const fs = require('fs');
const path = require('path');

const srcRenderer = path.resolve(__dirname, '../src/renderer');
const distRenderer = path.resolve(__dirname, '../dist/renderer');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(srcRenderer)) {
  copyDir(srcRenderer, distRenderer);
  console.log('[Assets] Renderer files copied to dist/renderer.');
}
