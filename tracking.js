/* Consent-gated phone-link measurement; no dependencies or dialing interception. */
(function () {
  "use strict";
  if (window.CheckeredFlagTracking) return;

  var input = window.CHECKERED_FLAG_TRACKING_CONFIG || {};
  var ga4 = /^G-[A-Z0-9]+$/.test(input.ga4MeasurementId || "") ? input.ga4MeasurementId : "";
  var ads = /^AW-\d+$/.test(input.googleAdsConversionId || "") &&
    /^[A-Za-z0-9_-]+$/.test(input.googleAdsConversionLabel || "") ? input.googleAdsConversionId : "";
  var configured = Boolean(ga4 || ads);
  var signature = [ga4, ads, ads ? input.googleAdsConversionLabel : ""].join("|");
  var storageKey = "checkered-flag-consent-v1";
  var consentLifetime = 180 * 24 * 60 * 60 * 1000;
  var consent = { analytics: false, advertising: false };
  var configuredTags = new Set();
  var tagStarted = false;
  var lastClick = -Infinity;
  var preferences;
  var privacyButton;
  var priorFocus;

  function command() {
    // An ad blocker or another script must never break normal phone links.
    try { window.gtag.apply(window, arguments); } catch (_) { /* Dialing continues. */ }
  }

  function googleConsent() {
    return {
      analytics_storage: consent.analytics && ga4 ? "granted" : "denied",
      ad_storage: consent.advertising && ads ? "granted" : "denied",
      ad_user_data: consent.advertising && ads ? "granted" : "denied",
      ad_personalization: "denied"
    };
  }

  function syncTags() {
    var analyticsAllowed = Boolean(ga4 && consent.analytics);
    var adsAllowed = Boolean(ads && consent.advertising);
    if (!tagStarted && !analyticsAllowed && !adsAllowed) return;

    if (!tagStarted) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      // Basic consent mode: the remote tag itself is withheld until opt-in.
      command("consent", "default", {
        analytics_storage: "denied", ad_storage: "denied",
        ad_user_data: "denied", ad_personalization: "denied"
      });
      command("js", new Date());
      command("set", "ads_data_redaction", true);
      tagStarted = true;
      var tag = document.createElement("script");
      tag.async = true;
      tag.src = "https://www.googletagmanager.com/gtag/js?id=" + (analyticsAllowed ? ga4 : ads);
      document.head.appendChild(tag);
    }
    command("consent", "update", googleConsent());
    [analyticsAllowed ? ga4 : "", adsAllowed ? ads : ""].forEach(function (id) {
      if (!id || configuredTags.has(id)) return;
      command("config", id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      configuredTags.add(id);
    });
  }

  function readChoice() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(storageKey));
      var age = saved && Date.now() - saved.savedAt;
      if (!saved || saved.signature !== signature || typeof saved.savedAt !== "number" ||
          age < 0 || age >= consentLifetime) return false;
      consent.analytics = saved.analytics === true;
      consent.advertising = saved.advertising === true;
      return true;
    } catch (_) { return false; }
  }

  function setConsent(choice) {
    consent.analytics = Boolean(ga4 && choice && choice.analytics === true);
    consent.advertising = Boolean(ads && choice && choice.advertising === true);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        analytics: consent.analytics, advertising: consent.advertising,
        signature: signature, savedAt: Date.now()
      }));
    } catch (_) { /* Choice still applies for this page when storage is unavailable. */ }
    syncTags();
    if (preferences) {
      preferences.hidden = true;
      var returnTo = priorFocus && document.contains(priorFocus) ? priorFocus : privacyButton;
      if (returnTo) returnTo.focus();
    }
  }

  function openPreferences() {
    if (!preferences) return;
    priorFocus = document.activeElement;
    preferences.querySelector("[name=analytics]").checked = consent.analytics;
    preferences.querySelector("[name=advertising]").checked = consent.advertising;
    preferences.hidden = false;
    preferences.querySelector("h2").focus();
  }

  function createPreferences(hasChoice) {
    preferences = document.createElement("section");
    preferences.className = "measurement-preferences";
    preferences.setAttribute("aria-labelledby", "measurement-title");
    preferences.setAttribute("role", "region");
    preferences.hidden = hasChoice;
    // Static markup only; identifiers and configuration never enter innerHTML.
    preferences.innerHTML = '<h2 id="measurement-title" tabindex="-1">Optional measurement</h2>' +
      '<p>With your permission, Google Analytics and Google Ads can measure taps on our shop number. ' +
      'A tap does not confirm a completed call. You can change your choice at any time.</p>' +
      '<form><label><input type="checkbox" name="analytics"> Google Analytics measurement</label>' +
      '<label><input type="checkbox" name="advertising"> Google Ads conversion measurement</label>' +
      '<div class="measurement-actions"><button type="submit" class="button button-small">Save choices</button>' +
      '<button type="button" class="measurement-decline">Decline optional</button></div></form>';
    var analyticsBox = preferences.querySelector("[name=analytics]");
    var adsBox = preferences.querySelector("[name=advertising]");
    analyticsBox.checked = consent.analytics;
    adsBox.checked = consent.advertising;
    analyticsBox.disabled = !ga4;
    adsBox.disabled = !ads;
    if (!ga4) analyticsBox.parentElement.hidden = true;
    if (!ads) adsBox.parentElement.hidden = true;
    preferences.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      setConsent({ analytics: analyticsBox.checked, advertising: adsBox.checked });
    });
    preferences.querySelector(".measurement-decline").addEventListener("click", function () {
      setConsent({ analytics: false, advertising: false });
    });
    try {
      var policyUrl = new URL(input.privacyPolicyUrl);
      if (policyUrl.protocol === "https:") {
        var policyLink = document.createElement("a");
        policyLink.href = policyUrl.href;
        policyLink.textContent = "Read our privacy notice";
        policyLink.className = "measurement-policy";
        preferences.appendChild(policyLink);
      }
    } catch (_) { /* A policy URL is optional; never create a broken link. */ }
    document.body.appendChild(preferences);
    privacyButton = document.createElement("button");
    privacyButton.type = "button";
    privacyButton.className = "privacy-choices";
    privacyButton.textContent = "Privacy choices";
    privacyButton.addEventListener("click", openPreferences);
    (document.querySelector(".footer-inner") || document.body).appendChild(privacyButton);
  }

  function onPhoneClick(event) {
    if (event.defaultPrevented || (typeof event.button === "number" && event.button !== 0)) return;
    var target = event.target && (event.target.closest ? event.target : event.target.parentElement);
    var link = target && target.closest('a[href^="tel:"]');
    if (!link) return;
    var analyticsAllowed = Boolean(ga4 && consent.analytics);
    var adsAllowed = Boolean(ads && consent.advertising);
    if (!analyticsAllowed && !adsAllowed) return;
    var now = Date.now();
    // Suppress accidental double taps across call buttons, without blocking the dialer.
    if (now - lastClick < 1500) return;
    lastClick = now;
    var location = link.getAttribute("data-call-location") || "website";
    if (analyticsAllowed) command("event", "phone_call_click", {
      send_to: ga4, link_location: location
    });
    if (adsAllowed) command("event", "conversion", {
      send_to: ads + "/" + input.googleAdsConversionLabel
    });
    // Never preventDefault, wait for a callback, or change window.location here.
  }

  window.CheckeredFlagTracking = Object.freeze({
    setConsent: setConsent,
    openPreferences: openPreferences,
    getState: function () {
      return { configured: configured, analytics: consent.analytics,
        advertising: consent.advertising, tagStarted: tagStarted };
    }
  });
  if (!configured) return;
  var hasChoice = readChoice();
  createPreferences(hasChoice);
  syncTags();
  document.addEventListener("click", onPhoneClick);
}());
