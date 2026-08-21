'use client';

import { useState } from 'react';

type Result = {
  svg: string;
  url: string;
  utms: Record<string, string>;
  warnings: string[];
};

const PLACEHOLDER =
  'https://www.aa.co.nz/membership/?utm_source=newsletter&utm_medium=email&utm_campaign=spring-renewal';

/** Turns the campaign name into a safe-ish file name, e.g. "aa-qr-spring-renewal". */
function fileName(utms: Record<string, string>, extension: string) {
  const campaign = (utms.utm_campaign ?? 'code').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `aa-qr-${campaign}.${extension}`;
}

function download(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

/** Rasterises the generated SVG in the browser so print teams can take a PNG. */
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
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed.'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function Page() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    setResult(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) setErrors(data.errors ?? ['Something went wrong.']);
      else setResult(data as Result);
    } catch {
      setErrors(['Could not reach the generator. Check your connection and try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>AA QR Code Generator</h1>
      <p className="lede">
        Paste a UTM-tagged aa.co.nz link. It is checked for the required tracking parameters and
        for redirects before a branded QR code is produced.
      </p>

      <form className="card" onSubmit={generate}>
        <label htmlFor="url">Campaign URL</label>
        <textarea
          id="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
        />
        <p className="hint">
          Must be https, on aa.co.nz or a subdomain, and include utm_source, utm_medium and
          utm_campaign.
        </p>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Checking link…' : 'Generate QR code'}
        </button>
      </form>

      {errors.length > 0 && (
        <div className="errors" role="alert">
          <strong>Cannot generate a QR code:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <section className="result">
          {result.warnings.length > 0 && (
            <div className="warnings">
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="preview" dangerouslySetInnerHTML={{ __html: result.svg }} />

          <p className="meta">{result.url}</p>

          <div className="row">
            <button
              className="primary"
              type="button"
              onClick={() =>
                download(new Blob([result.svg], { type: 'image/svg+xml' }), fileName(result.utms, 'svg'))
              }
            >
              Download SVG
            </button>
            <button
              className="secondary"
              type="button"
              onClick={async () => {
                try {
                  download(await svgToPng(result.svg), fileName(result.utms, 'png'));
                } catch (error) {
                  setErrors([(error as Error).message]);
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
            <li>Points at {new URL(result.url).hostname}</li>
            <li>Returned HTTP 200 with no redirect</li>
            <li>Tracking: {Object.entries(result.utms).map(([k, v]) => `${k}=${v}`).join(' · ')}</li>
          </ul>
        </section>
      )}
    </main>
  );
}
