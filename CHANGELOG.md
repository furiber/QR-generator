# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Paste a list of URLs, one per line (up to 50), and get a result card per link.
- Checkbox to include or omit the AA logo in the generated code.
- Download all: packs every passing code in a batch, SVG and PNG, into one ZIP,
  alongside a `urls.csv` manifest mapping every file to the URL it encodes.
- The encoded URL is recorded in each SVG's `<title>` and `<desc>`.

### Changed

- Downloaded files are named from the URL — host, path, campaign, source and
  medium — instead of the campaign alone, which gave every link in a campaign a
  near-identical name. The file name for a code is shown on its result card.

### Fixed

- The example insurance link in the form placeholder pointed at a page that now
  302s; it named a URL the tool itself would reject.

### Changed

- The AA logo now ships with the app instead of being fetched from aa.co.nz at
  request time, so generation no longer depends on an outbound fetch for artwork.

## [0.1.0] - 2026-08-22

### Added

- QR code generator for AA campaign links: paste a URL, get a branded QR code.
- URL validation requiring https, an aa.co.nz host (subdomains allowed), and the
  utm_source, utm_medium and utm_campaign parameters.
- Redirect check that refuses any URL not answering HTTP 200 directly, so a
  printed code can never depend on a redirect that drops its UTM parameters.
- AA primary logo centred in every QR code, with error correction level H.
- SVG and PNG downloads, plus a copy-URL button.
