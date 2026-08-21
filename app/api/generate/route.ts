import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { validateUrl } from '@/lib/validate';

/**
 * Validates a campaign URL and returns a branded QR code for it.
 *
 * Three gates, in order: the URL must satisfy the rules in lib/validate.ts,
 * it must answer 200 without redirecting (a QR code is printed and cannot be
 * re-pointed later, so a redirect chain is a defect worth blocking), and only
 * then is the SVG generated.
 */

const LOGO_URL =
  'https://www.aa.co.nz/content/dam/nzaa/01-brand/brand-assets/logos/primary/logo.svg';

const QR_SIZE = 1024;
// Fraction of the QR width covered by the logo plate. Error correction level H
// recovers ~30% of the modules, so this leaves plenty of headroom.
const LOGO_FRACTION = 0.22;

let cachedLogo: string | null = null;

async function getLogoDataUri(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(LOGO_URL, { cache: 'force-cache' });
    if (!res.ok) return null;
    const svg = await res.text();
    cachedLogo = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return cachedLogo;
  } catch {
    return null;
  }
}

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

function embedLogo(qrSvg: string, logoDataUri: string): string {
  const viewBox = qrSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
  if (!viewBox) return qrSvg;

  const size = Number(viewBox[1]);
  const plate = size * LOGO_FRACTION;
  const pad = plate * 0.08;
  const offset = (size - plate) / 2;

  const overlay =
    `<rect x="${offset - pad}" y="${offset - pad}" width="${plate + pad * 2}" height="${plate + pad * 2}" rx="${pad}" fill="#ffffff"/>` +
    `<image x="${offset}" y="${offset}" width="${plate}" height="${plate}" preserveAspectRatio="xMidYMid meet" href="${logoDataUri}"/>`;

  return qrSvg.replace('</svg>', `${overlay}</svg>`);
}

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errors: ['Invalid request body.'] }, { status: 400 });
  }

  const validation = validateUrl(body.url ?? '');
  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const redirectCheck = await checkNoRedirect(validation.url);
  if (!redirectCheck.ok) {
    return NextResponse.json({ errors: [redirectCheck.error] }, { status: 400 });
  }

  const qrSvg = await QRCode.toString(validation.url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    width: QR_SIZE,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const logo = await getLogoDataUri();

  return NextResponse.json({
    svg: logo ? embedLogo(qrSvg, logo) : qrSvg,
    url: validation.url,
    utms: validation.utms,
    warnings: logo ? [] : ['AA logo could not be fetched — QR code generated without it.'],
  });
}
