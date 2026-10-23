// Tạo bộ icon PWA từ logo (biểu tượng "layers" trên nền xanh, theo Figma).
// Chạy lại khi muốn đổi logo:  node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const PATHS = `
  <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/>
  <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/>`;

/** size: cạnh ảnh; pad: tỉ lệ lề cho logo; rounded: bo góc (iOS tự bo nên để vuông) */
const svg = ({ size, pad, rounded, bg = '#0077b6', fg = '#ffffff' }) => {
  const inner = size * (1 - 2 * pad);
  const scale = inner / 24;
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    ${bg ? `<rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/>` : ''}
    <g transform="translate(${size * pad} ${size * pad}) scale(${scale})" fill="none" stroke="${fg}"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS}</g></svg>`;
};

mkdirSync('public/icons', { recursive: true });
const out = [
  ['public/icons/icon-192.png', { size: 192, pad: 0.22, rounded: true }],
  ['public/icons/icon-512.png', { size: 512, pad: 0.22, rounded: true }],
  // "maskable": Android có thể cắt icon thành hình tròn -> chừa lề rộng hơn, không bo góc
  ['public/icons/maskable-512.png', { size: 512, pad: 0.3, rounded: false }],
  // iPhone dùng icon này khi "Thêm vào MH chính" (iOS tự bo góc)
  ['src/app/apple-icon.png', { size: 180, pad: 0.22, rounded: false }],
  ['src/app/icon.png', { size: 64, pad: 0.18, rounded: true }],
  // icon nhỏ đơn sắc trên thanh trạng thái Android
  ['public/icons/badge-96.png', { size: 96, pad: 0.12, rounded: false, bg: null, fg: '#ffffff' }],
];
for (const [file, opt] of out) {
  await sharp(Buffer.from(svg(opt))).png().toFile(file);
  console.log('✓', file);
}
