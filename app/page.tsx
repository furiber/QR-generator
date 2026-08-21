'use client';

import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { parseUrlList } from '@/lib/validate';
import { buildManifest, codeFileNames } from '@/lib/filename';

type Result =
  | { input: string; ok: true; svg: string; url: string; utms: Record<string, string> }
  | { input: string; ok: false; errors: string[] };

const PLACEHOLDER = `https://www.aa.co.nz/membership/?utm_source=newsletter&utm_medium=email&utm_campaign=spring-renewal
https://www.aa.co.nz/insurance/car-and-vehicle-insurance/?utm_source=poster&utm_medium=qr&utm_campaign=spring-renewal`;

function download(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

/** Rasterises a generated SVG in the browser so print teams can take a PNG. */
async function svgToPng(svg: string, size = 1024): Promise<Blob> {
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not render the QR code to PNG.'));
      image.src = source;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed.'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}

type Passing = Extract<Result, { ok: true }>;

/**
 * Packs every passing code into one ZIP: an SVG and a PNG per link, plus a
 * urls.csv manifest so the destination of each file is readable without opening
 * or scanning it.
 */
async function buildZip(passing: Passing[], baseNames: string[]): Promise<Blob> {
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};

  for (const [index, result] of passing.entries()) {
    const baseName = baseNames[index];
    const png = await svgToPng(result.svg);
    files[`${baseName}.svg`] = [strToU8(result.svg), { level: 6 }];
    // PNG is already compressed — deflating it again only costs time.
    files[`${baseName}.png`] = [new Uint8Array(await png.arrayBuffer()), { level: 0 }];
  }

  const manifest = buildManifest(
    passing.map((result, index) => ({ baseName: baseNames[index], url: result.url })),
  );
  files['urls.csv'] = [strToU8(manifest), { level: 6 }];

  return new Blob([zipSync(files)], { type: 'application/zip' });
}

export default function Page() {
  const [input, setInput] = useState('');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zipping, setZipping] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const urls = parseUrlList(input);
  const passing = results.filter((result): result is Passing => result.ok);
  // Named once for the whole batch so an individual download and its copy in
  // the ZIP always agree, including the -2 suffix applied to any collision.
  const baseNames = codeFileNames(passing.map((result) => result.url));
  const baseNameFor = (result: Passing) => baseNames[passing.indexOf(result)];

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResults([]);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls, includeLogo }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? 'Something went wrong.');
      else setResults(data.results as Result[]);
    } catch {
      setError('Could not reach the generator. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy
    ? 'Checking links…'
    : urls.length > 1
      ? `Generate ${urls.length} QR codes`
      : 'Generate QR code';

  return (
    <main>
      <h1>AA QR Code Generator</h1>
      <p className="lede">
        Paste one UTM-tagged aa.co.nz link per line. Each is checked for the required tracking
        parameters and for redirects before a QR code is produced.
      </p>

      <form className="card" onSubmit={generate}>
        <label htmlFor="urls">Campaign URLs — one per line</label>
        <textarea
          id="urls"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
        />
        <p className="hint">
          Must be https, on aa.co.nz or a subdomain, and include utm_source, utm_medium and
          utm_campaign. Up to 50 links at a time.
        </p>

        <label className="check">
          <input
            type="checkbox"
            checked={includeLogo}
            onChange={(event) => setIncludeLogo(event.target.checked)}
          />
          Include the AA logo in the centre of the code
        </label>

        <button className="primary" type="submit" disabled={busy || urls.length === 0}>
          {buttonLabel}
        </button>
      </form>

      {error && (
        <div className="errors" role="alert">
          <strong>Cannot generate:</strong> {error}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="summary">
            <span>
              {passing.length} of {results.length} link{results.length === 1 ? '' : 's'} passed.
            </span>
            {passing.length > 1 && (
              <button
                className="secondary"
                type="button"
                disabled={zipping}
                onClick={async () => {
                  setZipping(true);
                  try {
                    download(await buildZip(passing, baseNames), 'aa-qr-codes.zip');
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setZipping(false);
                  }
                }}
              >
                {zipping ? 'Packing…' : `Download all ${passing.length} (SVG + PNG, .zip)`}
              </button>
            )}
          </div>

          {results.map((result) => (
            <section className="result card" key={result.input}>
              <p className="meta">{result.input}</p>

              {!result.ok ? (
                <div className="errors" role="alert">
                  <ul>
                    {result.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="preview" dangerouslySetInnerHTML={{ __html: result.svg }} />

                  <div className="row">
                    <button
                      className="primary"
                      type="button"
                      onClick={() =>
                        download(
                          new Blob([result.svg], { type: 'image/svg+xml' }),
                          `${baseNameFor(result)}.svg`,
                        )
                      }
                    >
                      Download SVG
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={async () => {
                        try {
                          download(
                            await svgToPng(result.svg),
                            `${baseNameFor(result)}.png`,
                          );
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      Download PNG
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => navigator.clipboard.writeText(result.url)}
                    >
                      Copy URL
                    </button>
                  </div>

                  <ul className="checks">
                    <li>Returned HTTP 200 with no redirect</li>
                    <li>
                      File name: <code>{baseNameFor(result)}</code>
                    </li>
                    <li>
                      Tracking:{' '}
                      {Object.entries(result.utms)
                        .map(([key, value]) => `${key}=${value}`)
                        .join(' · ')}
                    </li>
                  </ul>
                </>
              )}
            </section>
          ))}
        </>
      )}
    </main>
  );
}
