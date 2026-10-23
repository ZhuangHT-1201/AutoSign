import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const svgPath = path.join(root, 'resources', 'icon.svg');
const pngPath = path.join(root, 'resources', 'icon.png');

await sharp(svgPath).resize(1024, 1024).png().toFile(pngPath);
await fs.access(pngPath);
console.log(`Generated ${pngPath}`);
