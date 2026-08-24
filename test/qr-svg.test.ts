import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';

const OPTIONS = {
  type: 'svg' as const,
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  width: 1024,
  color: { dark: '#000000', light: '#0000' },
};

test('QR SVG omits a light background fill', async () => {
  const svg = await QRCode.toString('https://www.aa.co.nz/', OPTIONS);
  assert.match(svg, /^<svg /);
  assert.doesNotMatch(svg, /fill="#ffffff"/);
  assert.doesNotMatch(svg, /d="M0 0h\d+v\d+H0z"/);
  assert.match(svg, /stroke="#000000"/);
});
