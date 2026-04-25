// Run with: node scripts/generate-icons.mjs
// Regenerates the PNG app icons from public/icon.svg.
// Requires: npm install --no-save sharp

import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('./public/icon.svg')

const targets = [
  { size: 192, file: 'public/icon-192.png' },
  { size: 512, file: 'public/icon-512.png' },
  { size: 180, file: 'public/apple-touch-icon.png' },
  { size: 32,  file: 'public/favicon-32.png' },
]

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(t.file)
  console.log(`✓ ${t.file} (${t.size}×${t.size})`)
}
