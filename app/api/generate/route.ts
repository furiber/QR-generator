import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { validateUrl } from '@/lib/validate';
import { AA_LOGO_DATA_URI } from '@/lib/logo';
import { checkLiveUrl } from '@/lib/live-check';

/**
 * Validates campaign URLs and returns a QR code for each one that passes.
 *
 * Two gates always run: the URL must satisfy the rules in lib/validate.ts, and
 * only then is the SVG generated. A third gate — the live HTTP check — fetches
 * the URL with redirects disabled and requires HTTP 200. That check can be
 * skipped with `skipLiveCheck` when a code is needed for a URL that is not
 * live yet (a printed QR still cannot be re-pointed later, so skipping is an
 * explicit opt-out).
 */

const QR_SIZE = 1024;
// Fraction of the QR width covered by the logo plate. Error correction level H
// recovers ~30% of the modules, so this leaves plenty of headroom.
const LOGO_FRACTION = 0.22;
const MAX_URLS = 50;

export type GenerateResult =
  | { input: string; ok: true; svg: string; url: string; utms: Record<string, string> }
  | { input: string; ok: false; errors: string[] };

/** Escapes text for inclusion in XML character data. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
    .replace(/'/g, '\u0026apos;');
}

/**
 * Records the encoded URL inside the SVG.
 *
 * A QR code on disk is unreadable to a human, so the destination goes in as
 * <title>/<desc>: it never renders, but it shows up in a browser tooltip, in a
 * text editor and to screen readers, which is the difference between a usable
 * artwork handover and a folder of identical squares.
 */
function embedUrlMetadata(qrSvg: string, url: string): string {
  const safe = escapeXml(url);
  return qrSvg.replace(
    /(<svg[^>]*>)/,
    `$1<title>QR code for ${safe}</title><desc>${safe}</desc>`,
  );
}

function embedLogo(qrSvg: string): string {
  const viewBox = qrSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
  if (!viewBox) return qrSvg;

  const size = Number(viewBox[1]);
  const plate = size * LOGO_FRACTION;
  const pad = plate * 0.08;
  const offset = (size - plate) / 2;

  const overlay =
    `<rect x="${offset - pad}" y="${offset - pad}" width="${plate + pad * 2}" height="${plate + pad * 2}" rx="${pad}" fill="#ffffff"/>` +
    `<image x="${offset}" y="${offset}" width="${plate}" height="${plate}" preserveAspectRatio="xMidYMid meet" href="${AA_LOGO_DATA_URI}"/>`;

  return qrSvg.replace('</svg>', `${overlay}</svg>`);
}

async function generateOne(
  input: string,
  includeLogo: boolean,
  skipLiveCheck: boolean,
): Promise<GenerateResult> {
  const validation = validateUrl(input);
  if (!validation.ok) return { input, ok: false, errors: validation.errors };

  if (!skipLiveCheck) {
    const liveCheck = await checkLiveUrl(validation.url);
    if (!liveCheck.ok) return { input, ok: false, errors: [liveCheck.error] };
  }

  const qrSvg = await QRCode.toString(validation.url, {
    type: 'svg',
    // Level H is kept even without the logo so a code stays readable when it is
    // printed small, scuffed or photographed at an angle.
    errorCorrectionLevel: 'H',
    margin: 2,
    width: QR_SIZE,
    // Alpha 0 on the light colour omits the background path entirely, so the
    // SVG is transparent and can sit on any print colour.
    color: { dark: '#000000', light: '#0000' },
  });

  return {
    input,
    ok: true,
    svg: embedUrlMetadata(includeLogo ? embedLogo(qrSvg) : qrSvg, validation.url),
    url: validation.url,
    utms: validation.utms,
  };
}

export async function POST(request: Request) {
  let body: { urls?: unknown; includeLogo?: unknown; skipLiveCheck?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : [];
  if (urls.length === 0) {
    return NextResponse.json({ error: 'Enter at least one URL.' }, { status: 400 });
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `Too many URLs — ${MAX_URLS} at a time, got ${urls.length}.` },
      { status: 400 },
    );
  }

  const includeLogo = body.includeLogo !== false;
  const skipLiveCheck = body.skipLiveCheck === true;
  const results = await Promise.all(urls.map((url) => generateOne(url, includeLogo, skipLiveCheck)));

  return NextResponse.json({ results });
}
