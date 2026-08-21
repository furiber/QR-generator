/**
 * URL rules for AA campaign QR codes.
 *
 * A URL is only accepted when it is an https link to aa.co.nz (or any
 * subdomain of it) and carries the three UTM parameters the marketing team
 * requires. Redirect checking happens separately, server-side, because it
 * needs a network request.
 */

export const REQUIRED_UTMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
export const OPTIONAL_UTMS = ['utm_term', 'utm_content', 'utm_id'] as const;

const ROOT_DOMAIN = 'aa.co.nz';

export type ValidationResult =
  | { ok: true; url: string; hostname: string; utms: Record<string, string> }
  | { ok: false; errors: string[] };

export function validateUrl(raw: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = (raw ?? '').trim();

  if (!trimmed) return { ok: false, errors: ['Enter a URL.'] };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, errors: ['Not a valid URL — include the https:// prefix.'] };
  }

  if (url.protocol !== 'https:') {
    errors.push(`Must use https:// (got ${url.protocol.replace(':', '') || 'nothing'}).`);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== ROOT_DOMAIN && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    errors.push(`Must point at ${ROOT_DOMAIN} or a subdomain of it (got ${hostname || 'no host'}).`);
  }

  const utms: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of REQUIRED_UTMS) {
    const value = url.searchParams.get(key)?.trim();
    if (!value) missing.push(key);
    else utms[key] = value;
  }
  if (missing.length) {
    errors.push(`Missing or empty UTM parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);
  }
  for (const key of OPTIONAL_UTMS) {
    const value = url.searchParams.get(key)?.trim();
    if (value) utms[key] = value;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, url: url.toString(), hostname, utms };
}

/** Splits a pasted block into one URL per line, dropping blanks and duplicates. */
export function parseUrlList(raw: string): string[] {
  const seen = new Set<string>();
  for (const line of (raw ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}
