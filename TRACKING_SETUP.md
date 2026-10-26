# Phone-click measurement setup

## Current status

Measurement is **disabled**. `tracking-config.js` contains blank identifiers. No Google Ads or GA4 tag is downloaded, no consent controls appear, and every phone link works without JavaScript. The existing Google Maps embed is separate from this measurement code and still contacts Google when it loads.

This implementation measures **taps/clicks on telephone links**, not completed calls, call duration, appointments, or paying customers. Delivery can be lost if the dialer opens before a queued request sends, the visitor declines consent, or tracking is blocked. The code never delays dialing to improve tracking delivery.

## Enter the shop's real identifiers

Edit `tracking-config.js`:

| Field | Value to copy from the shop's account |
| --- | --- |
| `googleAdsConversionId` | Google Ads tag/conversion ID including the `AW-` prefix |
| `googleAdsConversionLabel` | The label for the **phone-link click** conversion action |
| `ga4MeasurementId` | GA4 web data stream measurement ID including the `G-` prefix |
| `privacyPolicyUrl` | HTTPS URL of the shop's published privacy notice, reviewed before activation |

These are public measurement identifiers, not account passwords. Leave either destination blank to keep it disabled. The Ads destination requires both its ID and label. Malformed or incomplete identifiers are ignored. Do not paste an entire tag snippet or account login into a field.

Before activation, review the shop's privacy notice, Google product settings, and consent requirements for its visitors. The supplied basic consent controls are an implementation aid, not a determination of applicable legal requirements. No remarketing or ad personalization is enabled by this code.

After editing a CSS or JS file, refresh the `?v=` queries in `index.html` to avoid stale cached files. From the repository, run:

```text
python tests/check_site.py --update-versions
```

The helper uses the first 12 SHA-256 characters after normalizing text line endings, so the versions work in both Windows and GitHub Pages checkouts. It also validates the site.

Commit and push the configuration and updated HTML together. Never add a second Google tag snippet, inline `onclick` conversion snippet, or Tag Manager phone-click trigger alongside this implementation.

## Create the Google Ads conversion action

In Google Ads, open **Goals → Conversions → Summary** and create/select the conversion for **clicks on a number on your mobile website**. Google changes its setup screens; use the phone-click/event setup, rather than a page-load conversion or a verified-call action. Name it clearly, such as “Website phone-link click.” Copy its conversion ID and label into the configuration file.

Use **One** as the lead counting setting. Consider keeping this proxy signal **Secondary** for observation while you validate actual call quality; keep it out of custom bidding goals if it should not guide bidding. Do not assign an invented sales value. This code sends no price or revenue amount.

For verified calls and call duration, a separate Google forwarding-number website-call setup is needed. That is not installed here, and the shop's displayed number is not replaced.

## GA4 and avoiding double-counting

When configured and consented, GA4 receives `phone_call_click` with a non-personal `link_location` such as `hero`, `contact`, or `engine-service`. Each event is explicitly routed to the configured GA4 stream. Ads receives one `conversion` event routed only to its configured ID/label. Automatic page-view sending and Google Signals are disabled in this implementation.

Choose **one** Ads conversion source for phone clicks: the direct Ads action supplied here, or a GA4 event imported into Ads. If using a GA4 import, leave the Ads ID/label blank. Do not import the same GA4 phone event as another primary conversion while the direct Ads action is also primary. Avoid duplicate GA4 streams, enhanced-measurement/custom event rules, and Tag Manager triggers that count the same action again.

One delegated listener handles every phone link, including nested text/icons and keyboard activation. Repeated script inclusion does not attach another listener; taps within 1.5 seconds are treated as one activation. This is accidental-tap suppression, not a count of unique callers. Google's “One” setting separately controls counting per ad interaction.

## Consent behavior

With valid identifiers, a small preference panel offers independent Analytics and Ads checkboxes, both initially off, plus “Save choices” and “Decline optional.” The footer gains “Privacy choices” for reopening it. Only an explicitly granted, configured destination loads or receives phone events. Earlier clicks are not replayed after consent.

The choice is stored locally for up to 180 days, scoped to the configured identifiers; changed identifiers or expired choices prompt again. If storage is blocked, the choice lasts only for the current page. Withdrawal updates Google's consent flags and suppresses further phone-click events; a Google tag already loaded during a prior opt-in remains in memory until the page closes. Ad personalization stays denied.

A consent platform can use `window.CheckeredFlagTracking.setConsent({ analytics: true, advertising: false })` **only after collecting that visitor's choice**. Do not call this automatically on page load to bypass consent. `getState()` reports configuration and current consent; it does not prove a conversion request reached Google.

## Test before relying on reports

1. Run `node tests/tracking.test.cjs`, `node --check tracking.js`, and `python tests/check_site.py`.
2. With real IDs configured, connect the public site to [Tag Assistant](https://tagassistant.google.com/). Start with cleared site storage or a private browser session.
3. Before opting in, verify no Ads/GA4 measurement tag or events load. Decline and repeat. Maps requests are unrelated to this check.
4. Allow Analytics only, click one call link, and verify one `phone_call_click` goes to the GA4 stream and no Ads conversion fires. Allow Ads only and verify the reverse. With both allowed, expect one event per destination for one activation. In GA4, confirm receipt in Realtime; DebugView requires debug mode enabled for the test session.
5. Try a different call button after 1.5 seconds, then a rapid double tap. Check normal dialer behavior, keyboard activation, consent withdrawal, and a browser with tracking blocked. Tag Assistant does not prove that a call connected or that an event qualified for ad attribution.
6. If measurement remains unverified/inactive, check the ID/label, published asset versions, consent, blockers, and the product's reporting delay. Never click the shop's own live paid ad just to test tracking.

## Google reference pages

- [Phone number clicks versus actual calls](https://support.google.com/google-ads/answer/6095878)
- [Click-event conversion setup](https://support.google.com/google-ads/answer/6331304)
- [Verified calls using forwarding numbers](https://support.google.com/google-ads/answer/6095883)
- [One versus every conversion](https://support.google.com/google-ads/answer/3438531)
- [Primary versus secondary conversion actions](https://support.google.com/google-ads/answer/11461796)
- [Basic versus advanced consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
