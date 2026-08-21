'use client';

import { useState } from 'react';
import { parseUrlList } from '@/lib/validate';

type Result =
  | { input: string; ok: true; svg: string; url: string; utms: Record<string, string> }
  | { input: string; ok: false; errors: string[] };

const PLACEHOLDER = `https://www.aa.co.nz/membership/?utm_source=newsletter&utm_medium=email&utm_campaign=spring-renewal
https://www.aa.co.nz/insurance/car-insurance/?utm_source=poster&utm_medium=qr&utm_campaign=spring-renewal`;

/** Turns the campaign name into a safe-ish file name, e.g. "aa-qr-spring-renewal". */
function fileName(utms: Record<string, string>, extension: string, suffix?: number) {
  const campaign = (utms.utm_campaign ?? 'code').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `aa-qr-${campaign}${suffix ? `-${suffix}` : ''}.${extension}`;
}

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

export default function Page() {
  const [input, setInput] = useState('');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Result[]>([]);

  const urls = parseUrlList(input);
  const passed = results.filter((result) => result.ok).length;

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
          <p className="summary">
            {passed} of {results.length} link{results.length === 1 ? '' : 's'} passed.
          </p>

          {results.map((result, index) => (
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
                          fileName(result.utms, 'svg', results.length > 1 ? index + 1 : undefined),
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
                            fileName(result.utms, 'png', results.length > 1 ? index + 1 : undefined),
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
