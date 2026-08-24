import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLiveUrl } from '../lib/live-check.ts';

const URL = 'https://www.aa.co.nz/membership/?utm_source=eml&utm_medium=email&utm_campaign=renew';

function mockFetch(impl: typeof fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test('accepts HTTP 200 with no redirect', async () => {
  const restore = mockFetch(async () => new Response('ok', { status: 200 }));
  try {
    assert.deepEqual(await checkLiveUrl(URL), { ok: true });
  } finally {
    restore();
  }
});

test('rejects a 404', async () => {
  const restore = mockFetch(async () => new Response('missing', { status: 404 }));
  try {
    const result = await checkLiveUrl(URL);
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /HTTP 404/);
  } finally {
    restore();
  }
});

test('rejects a redirect and names the Location', async () => {
  const restore = mockFetch(
    async () =>
      new Response(null, {
        status: 301,
        headers: { location: 'https://www.aa.co.nz/membership/' },
      }),
  );
  try {
    const result = await checkLiveUrl(URL);
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /redirects \(HTTP 301\)/);
    assert.match((result as { error: string }).error, /https:\/\/www\.aa\.co\.nz\/membership\//);
  } finally {
    restore();
  }
});

test('rejects an unreachable URL', async () => {
  const restore = mockFetch(async () => {
    throw new Error('getaddrinfo ENOTFOUND');
  });
  try {
    const result = await checkLiveUrl(URL);
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /Could not reach the URL/);
  } finally {
    restore();
  }
});

test('does not follow redirects (fetch is called with redirect: manual)', async () => {
  let init: RequestInit | undefined;
  const restore = mockFetch(async (_input, options) => {
    init = options;
    return new Response('ok', { status: 200 });
  });
  try {
    await checkLiveUrl(URL);
    assert.equal(init?.redirect, 'manual');
    assert.equal(init?.method, 'GET');
  } finally {
    restore();
  }
});
