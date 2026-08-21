# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-22

### Added

- QR code generator for AA campaign links: paste a URL, get a branded QR code.
- URL validation requiring https, an aa.co.nz host (subdomains allowed), and the
  utm_source, utm_medium and utm_campaign parameters.
- Redirect check that refuses any URL not answering HTTP 200 directly, so a
  printed code can never depend on a redirect that drops its UTM parameters.
- AA primary logo centred in every QR code, with error correction level H.
- SVG and PNG downloads, plus a copy-URL button.
