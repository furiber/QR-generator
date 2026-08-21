import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl } from '../lib/validate.ts';

const good = 'https://www.aa.co.nz/membership/?utm_source=eml&utm_medium=email&utm_campaign=renew';

test('accepts an https aa.co.nz URL with all required UTMs', () => {
  const result = validateUrl(good);
  assert.equal(result.ok, true);
});

test('accepts subdomains', () => {
  assert.equal(validateUrl(good.replace('www.', 'insurance.')).ok, true);
});

test('rejects lookalike domains', () => {
  const result = validateUrl(good.replace('www.aa.co.nz', 'notaa.co.nz'));
  assert.equal(result.ok, false);
});

test('rejects http', () => {
  assert.equal(validateUrl(good.replace('https:', 'http:')).ok, false);
});

test('rejects a missing utm_campaign', () => {
  const result = validateUrl(good.replace('&utm_campaign=renew', ''));
  assert.equal(result.ok, false);
  assert.match((result as { errors: string[] }).errors.join(' '), /utm_campaign/);
});

test('rejects an empty utm value', () => {
  assert.equal(validateUrl(good.replace('utm_medium=email', 'utm_medium=')).ok, false);
});

test('rejects junk input', () => {
  assert.equal(validateUrl('not a url').ok, false);
});

test('parses a pasted list, dropping blanks and duplicates', async () => {
  const { parseUrlList } = await import('../lib/validate.ts');
  const parsed = parseUrlList(`  ${good}  \r\n\n${good}\n${good.replace('www.', 'insurance.')}\n`);
  assert.deepEqual(parsed, [good, good.replace('www.', 'insurance.')]);
});

test('parses an empty block to an empty list', async () => {
  const { parseUrlList } = await import('../lib/validate.ts');
  assert.deepEqual(parseUrlList('\n  \n'), []);
});

test('names a file from the URL, not just the campaign', async () => {
  const { codeBaseName } = await import('../lib/filename.ts');
  assert.equal(
    codeBaseName('https://www.aa.co.nz/membership/?utm_source=newsletter&utm_medium=email&utm_campaign=spring-renewal'),
    'aa-qr_www_membership_spring-renewal_newsletter_email',
  );
  assert.equal(
    codeBaseName('https://insurance.aa.co.nz/car/quote/?utm_source=poster&utm_medium=qr&utm_campaign=spring-renewal'),
    'aa-qr_insurance_car-quote_spring-renewal_poster_qr',
  );
  assert.equal(
    codeBaseName('https://aa.co.nz/?utm_source=poster&utm_medium=qr&utm_campaign=spring-renewal'),
    'aa-qr_aa_home_spring-renewal_poster_qr',
  );
});

test('gives two links from one campaign different names', async () => {
  const { codeFileNames } = await import('../lib/filename.ts');
  const names = codeFileNames([
    'https://www.aa.co.nz/membership/?utm_source=newsletter&utm_medium=email&utm_campaign=renew',
    'https://www.aa.co.nz/insurance/?utm_source=newsletter&utm_medium=email&utm_campaign=renew',
  ]);
  assert.equal(new Set(names).size, 2);
});

test('suffixes names that would otherwise collide', async () => {
  const { codeFileNames } = await import('../lib/filename.ts');
  const url = 'https://www.aa.co.nz/membership/?utm_source=eml&utm_medium=email&utm_campaign=renew';
  const names = codeFileNames([url, `${url}&utm_content=a`, `${url}&utm_content=b`]);
  assert.deepEqual(names, [
    'aa-qr_www_membership_renew_eml_email',
    'aa-qr_www_membership_renew_eml_email-2',
    'aa-qr_www_membership_renew_eml_email-3',
  ]);
});

test('quotes manifest fields so a comma in a URL cannot break a row', async () => {
  const { buildManifest } = await import('../lib/filename.ts');
  const csv = buildManifest([
    {
      baseName: 'aa-qr_www_membership_a-b_eml_email',
      url: 'https://www.aa.co.nz/membership/?utm_source=eml&utm_medium=email&utm_campaign=a,b',
    },
  ]);
  const [header, row] = csv.trim().split('\r\n');
  assert.equal(header.split(',').length, 6);
  assert.match(row, /"a,b"$/);
  assert.match(row, /^"aa-qr_www_membership_a-b_eml_email\.svg","aa-qr_www_membership_a-b_eml_email\.png"/);
});
