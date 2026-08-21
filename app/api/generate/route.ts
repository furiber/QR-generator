import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { validateUrl } from '@/lib/validate';
import { AA_LOGO_DATA_URI } from '@/lib/logo';

/**
 * Validates campaign URLs and returns a QR code for each one that passes.
 *
 * Three gates, in order: the URL must satisfy the rules in lib/validate.ts, it
 * must answer 200 without redirecting (a QR code is printed and cannot be
 * re-pointed later, so a redirect chain is a defect worth blocking), and only
 * then is the SVG generated.
 */

const QR_SIZE = 1024;
// Fraction of the QR width covered by the logo plate. Error correction level H
// recovers ~30% of the modules, so this leaves plenty of headroom.
const LOGO_FRACTION = 0.22;
const MAX_URLS = 50;

export type GenerateResult =
  | { input: string; ok: true; svg: string; url: string; utms: Record<string, string> }
  | { input: string; ok: false; errors: string[] };

type RedirectCheck = { ok: true } | { ok: false; error: string };

async function checkNoRedirect(url: string): Promise<RedirectCheck> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'user-agent': 'AA-QR-Generator/1.0 (+link check)' },
    });
  } catch (err) {
    return { ok: false, error: `Could not reach the URL: ${(err as Error).message}` };
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    return {
      ok: false,
      error: `URL redirects (HTTP ${res.status})${location ? ` to ${location}` : ''}. Use the final destination URL instead.`,
    };
  }
  if (res.status !== 200) {
    return { ok: false, error: `URL returned HTTP ${res.status}, expected 200.` };
  }
  return { ok: true };
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

async function generateOne(input: string, includeLogo: boolean): Promise<GenerateResult> {
  const validation = validateUrl(input);
  if (!validation.ok) return { input, ok: false, errors: validation.errors };

  const redirectCheck = await checkNoRedirect(validation.url);
  if (!redirectCheck.ok) return { input, ok: false, errors: [redirectCheck.error] };

  const qrSvg = await QRCode.toString(validation.url, {
    type: 'svg',
    // Level H is kept even without the logo so a code stays readable when it is
    // printed small, scuffed or photographed at an angle.
    errorCorrectionLevel: 'H',
    margin: 2,
    width: QR_SIZE,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return {
    input,
    ok: true,
    svg: includeLogo ? embedLogo(qrSvg) : qrSvg,
    url: validation.url,
    utms: validation.utms,
  };
}

export async function POST(request: Request) {
  let body: { urls?: unknown; includeLogo?: unknown };
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
  const results = await Promise.all(urls.map((url) => generateOne(url, includeLogo)));

  return NextResponse.json({ results });
}
