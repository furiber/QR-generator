# AA QR Code Generator

Generates branded QR codes for AA marketing links. A code is only produced once the
URL passes every check, because a printed QR code cannot be corrected later.

Paste one URL per line — up to 50 at a time — and each is checked independently.

## Checks

1. **Valid https URL** — anything else is rejected outright.
2. **AA domain** — the host must be `aa.co.nz` or a subdomain of it.
3. **UTM parameters** — `utm_source`, `utm_medium` and `utm_campaign` must all be
   present and non-empty. `utm_term`, `utm_content` and `utm_id` are passed through
   when supplied.
4. **No redirects** — the URL is fetched with redirects disabled and must return
   HTTP 200. This matters: `https://www.aa.co.nz/membership?utm_source=…` returns a
   301 to `https://www.aa.co.nz/membership/` **without** the query string, so the
   tracking parameters are silently lost. The generator blocks that case and tells
   you to use the final destination URL.

## Output

The QR code is produced server-side as SVG at error correction level H. When the
**Include the AA logo** box is ticked (the default) the AA primary logo is placed
over the centre 22% — well inside the ~30% the H level can recover. Untick it for a
plain black-and-white code.

The logo ships with the app: `assets/aa-logo.svg` is vendored from the AA brand
library and inlined as a data URI in `lib/logo.ts`, so generation never depends on a
network fetch. Re-run the inlining if the brand asset changes.

Both formats are offered per code: **SVG** for print and **PNG** (1024×1024,
rasterised in the browser) for anything that cannot take vector artwork. When a
batch produces more than one code, **Download all** packs every passing code —
both formats — into a single `aa-qr-codes.zip`.

### Telling codes apart

A QR code is unreadable to a human, so the destination travels with the file
three ways:

- **The file name is built from the URL**, not just the campaign:
  `aa-qr_www_membership_spring-renewal_newsletter_email.svg` — host label, path,
  campaign, source, medium. Two links from one campaign therefore never share a
  name; the rare pair that differs only in a parameter the name omits (such as
  `utm_content`) gets a `-2` suffix.
- **The SVG carries the URL** in its `<title>` and `<desc>`, which never render
  but show up as a browser tooltip, in a text editor and to screen readers.
- **The ZIP contains `urls.csv`**, mapping each SVG and PNG back to its full URL
  and UTM parameters.

## Local development

```bash
npm install
npm run dev
```

```bash
npm test
```

## Deploying to Vercel

The app is a stock Next.js App Router project with no environment variables and no
external services, so it deploys as-is:

```bash
vercel deploy
```

The redirect check runs in the Vercel Function backing `/api/generate`, which needs
outbound network access to `aa.co.nz` — the default.
