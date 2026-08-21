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
