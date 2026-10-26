# Website audit and optimization — October 26, 2026

## Architecture and deployment audit

- Static site: `index.html` is the only public HTML entry point; `styles.css` defines the dark theme and responsive grids. Four optimized service photos are local WebP files. No framework, package manager, build step, or existing JavaScript/analytics was present.
- GitHub remote: `joshuabennie/checkered-flag-site`; branch `main`. GitHub Pages API confirmed branch deployment from `/`, legacy Pages build, HTTPS enforced.
- Existing navigation uses real fragment links, so it works without scripts. Call buttons previously used a domestic-format telephone URI. Photos already had dimensions, lazy loading, and descriptive alt text. The Google map is lazy-loaded.
- SEO gaps: generic brand-led title; missing canonical, sharing metadata, structured business data, and sitemap; hero H1 emphasized the slogan instead of services/location.
- Accessibility gaps: several compact navigation/call targets were below 44px; no tracking consent experience existed because no measurement was installed.

## Changes

- Accurate service/location title and description; canonical URL; index/follow metadata; Open Graph and X/Twitter sharing metadata using the existing engine photograph.
- One visible H1, “Engine & Transmission Repair in Baton Rouge,” occupies the existing small hero-label position. The large slogan, typography, palette, racing graphic, stock photos, four-card layout, and section order remain.
- Concise hero/service copy now explicitly mentions engine and transmission replacement alongside repair and diagnostics. No new pricing, hours, certifications, ratings, or warranty guarantees were added. The owner's previously requested red-banner wording remains.
- `AutoRepair` JSON-LD identifies the supplied business name, postal address, E.164 phone number, website, Baton Rouge service area, and seven service offers. It contains no invented reviews or opening hours.
- All eight telephone links use `tel:+12253554920`; stable non-personal labels support measurement. Touch targets and focus styles are improved. The current hero already has a prominent mobile call button, so no additional sticky bar was added.
- Consent-gated measurement, off by default, supports GA4 and direct Google Ads phone-click conversion events. No dependencies or third-party tracking services were added. See `TRACKING_SETUP.md` for required IDs and testing.
- `sitemap.xml` lists the canonical homepage. No project-level `robots.txt` was added: Google reads robots rules at the hostname root, `https://joshuabennie.github.io/robots.txt`, which this project repository does not own. A file in `/checkered-flag-site/` would not control crawling. The homepage's robots meta tag permits indexing.

## Validation commands

```text
node tests/tracking.test.cjs
node --check tracking.js
node --check tracking-config.js
python tests/check_site.py
git diff --check
```

The Node tests use a local DOM/tag harness and make no network requests. They exercise missing/invalid identifiers, independent consent, no pre-consent events, consent withdrawal, duplicates/double taps, blocked storage/tag functions, saved-choice expiry, nested call-link clicks, and the preferences controls.

The Python checks validate metadata consistency, one service/location H1, heading levels, JSON-LD shape and supplied business details, sitemap XML, all eight telephone links, four image attributes, internal fragments, deferred scripts, project-relative resources, and asset-version hashes. They are local checks, not a Google ranking or rich-results guarantee.

Browser review and deployed endpoint checks are recorded in the completion report. Real Google tag delivery, Ads attribution, and GA4 receipt cannot be tested until the shop supplies its own identifiers and consented test sessions. Field performance/Core Web Vitals require real traffic; no Lighthouse score is claimed.

Local QA passed: 10 measurement behavior tests, JavaScript syntax checks, metadata/schema/sitemap/asset checks, and browser layouts at 320, 768, and 1440 pixels. All eight phone targets measured at least 44 pixels high; no horizontal overflow or clipped heading/paragraph text was found. All four service images loaded. Services, About, and Contact navigation reached their sections. The browser showed zero remote Google measurement scripts, zero consent panels with blank configuration, and no JavaScript errors during the default-state check.

## Account work remaining

1. Supply GA4 measurement ID and/or Google Ads conversion ID plus label; review the shop's privacy notice before activation.
2. Point the relevant Google Ads Final URL and Google Business Profile website field to the canonical public address. Campaign/account settings were not changed by this website task.
3. Verify the project URL-prefix property in Search Console using the shop owner's chosen verification method, submit `https://joshuabennie.github.io/checkered-flag-site/sitemap.xml`, and inspect the homepage for indexing. No verification token was invented or added.
4. Review actual call quality, local targeting, and conversion reporting before changing campaign budgets or bidding.

References: [Schema.org AutoRepair](https://schema.org/AutoRepair), [service offer catalog](https://schema.org/hasOfferCatalog), [Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
