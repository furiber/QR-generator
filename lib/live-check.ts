/**
 * Live HTTP check for campaign URLs.
 *
 * A QR code is printed and cannot be re-pointed later, so a 404 or a redirect
 * chain (which can drop UTM parameters) is treated as a defect. Callers can
 * skip this check when they still want a code for a URL that is not live yet.
 */

export type LiveCheck = { ok: true } | { ok: false; error: string };

export async function checkLiveUrl(url: string): Promise<LiveCheck> {
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
