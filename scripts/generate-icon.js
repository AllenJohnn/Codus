// scripts/generate-icon.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const size = 128;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Fill background black
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, size, size);

// Draw white "Co" monogram centered
ctx.fillStyle = '#fff';
ctx.font = 'bold 56px "Courier New", Courier, monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Co', size / 2, size / 2 + 4);

// Ensure output directory exists
const outDir = path.join(__dirname, '../extension/images');
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'icon.png');
const out = fs.createWriteStream(outPath);
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => {
  console.log('Icon saved to', outPath);
});
