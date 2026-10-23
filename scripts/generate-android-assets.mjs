import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const source = path.join(root, 'resources', 'icon.png');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
const densities = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

for (const [density, scale] of Object.entries(densities)) {
  const directory = path.join(res, `mipmap-${density}`);
  await fs.mkdir(directory, { recursive: true });
  const iconSize = Math.round(48 * scale);
  const foregroundSize = Math.round(108 * scale);
  const glyphSize = Math.round(foregroundSize * 0.72);

  await sharp(source).resize(iconSize, iconSize).png().toFile(path.join(directory, 'ic_launcher.png'));

  const roundMask = Buffer.from(
    `<svg width="${iconSize}" height="${iconSize}"><circle cx="${iconSize / 2}" cy="${iconSize / 2}" r="${iconSize / 2}" fill="white"/></svg>`,
  );
  const roundIcon = await sharp(source)
    .resize(iconSize, iconSize)
    .composite([{ input: roundMask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  await fs.writeFile(path.join(directory, 'ic_launcher_round.png'), roundIcon);

  const foreground = await sharp(source)
    .resize(glyphSize, glyphSize)
    .extend({
      top: Math.round((foregroundSize - glyphSize) / 2),
      bottom: foregroundSize - glyphSize - Math.round((foregroundSize - glyphSize) / 2),
      left: Math.round((foregroundSize - glyphSize) / 2),
      right: foregroundSize - glyphSize - Math.round((foregroundSize - glyphSize) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(directory, 'ic_launcher_foreground.png'), foreground);
}

const splashDirectories = (await fs.readdir(res)).filter((entry) => entry.startsWith('drawable'));
for (const directory of splashDirectories) {
  const file = path.join(res, directory, 'splash.png');
  try {
    const metadata = await sharp(file).metadata();
    if (!metadata.width || !metadata.height) continue;
    const glyph = Math.max(96, Math.round(Math.min(metadata.width, metadata.height) * 0.24));
    const logo = await sharp(source).resize(glyph, glyph).png().toBuffer();
    await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: '#f3f5f0',
      },
    })
      .composite([
        {
          input: logo,
          left: Math.round((metadata.width - glyph) / 2),
          top: Math.round((metadata.height - glyph) / 2),
        },
      ])
      .png()
      .toFile(file);
  } catch {
    // The directory does not contain a splash image.
  }
}

console.log('Android launcher icons and splash images generated');
