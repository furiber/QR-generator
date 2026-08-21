/**
 * File naming for generated codes.
 *
 * A QR code is opaque once it leaves the browser, so the file name has to carry
 * enough of the URL to tell two codes apart on a shared drive — the campaign
 * name alone does not, since one campaign routinely produces a dozen links that
 * differ only by landing page or by source.
 *
 * Shape: aa-qr_<host>_<path>_<campaign>_<source>_<medium>.<ext>
 *   https://www.aa.co.nz/membership/?utm_source=newsletter&utm_medium=email&utm_campaign=spring-renewal
 *   -> aa-qr_www_membership_spring-renewal_newsletter_email.svg
 *
 * Groups are separated by underscores and words within a group by hyphens, so
 * the boundaries survive a glance.
 */

const MAX_LENGTH = 150;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The name without an extension, e.g. "aa-qr_www_membership_spring-renewal_newsletter_email". */
export function codeBaseName(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'aa-qr_code';
  }

  // "www.aa.co.nz" -> "www", "insurance.aa.co.nz" -> "insurance", "aa.co.nz" -> "aa".
  const host = slug(url.hostname.replace(/\.?aa\.co\.nz$/i, '')) || 'aa';
  const path = slug(url.pathname) || 'home';

  const groups = [
    'aa-qr',
    host,
    path,
    slug(url.searchParams.get('utm_campaign') ?? ''),
    slug(url.searchParams.get('utm_source') ?? ''),
    slug(url.searchParams.get('utm_medium') ?? ''),
  ].filter(Boolean);

  return groups.join('_').slice(0, MAX_LENGTH).replace(/[-_]+$/, '');
}

/**
 * Names one file per URL, appending -2, -3 … to any name claimed twice. Two
 * URLs collide only when they differ solely in a parameter the name omits, such
 * as utm_content.
 */
export function codeFileNames(urls: string[]): string[] {
  const used = new Map<string, number>();

  return urls.map((url) => {
    const base = codeBaseName(url);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  });
}

/** Escapes one CSV field: quote it, and double any quote inside it. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** A manifest tying every file in the ZIP back to the URL it encodes. */
export function buildManifest(entries: { baseName: string; url: string }[]): string {
  const rows = [['svg_file', 'png_file', 'url', 'utm_source', 'utm_medium', 'utm_campaign']];

  for (const { baseName, url } of entries) {
    const params = new URL(url).searchParams;
    rows.push([
      `${baseName}.svg`,
      `${baseName}.png`,
      url,
      params.get('utm_source') ?? '',
      params.get('utm_medium') ?? '',
      params.get('utm_campaign') ?? '',
    ]);
  }

  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
