const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'tracking.js'), 'utf8');
const ids = { ga4MeasurementId: 'G-TEST0001', googleAdsConversionId: 'AW-123456789', googleAdsConversionLabel: 'TestLabel' };

function fixture(config, options = {}) {
  let clock = 2000000000000;
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.hidden = false; }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, listener) { (this.listeners ||= {})[name] = listener; }
    focus() { document.activeElement = this; }
    set innerHTML(value) {
      this.markup = value;
      this.nodes = Object.fromEntries(['[name=analytics]', '[name=advertising]', 'form', '.measurement-decline', 'h2'].map(key => [key, new Element(key)]));
      this.nodes['[name=analytics]'].parentElement = new Element('label');
      this.nodes['[name=advertising]'].parentElement = new Element('label');
    }
    querySelector(selector) { return this.nodes?.[selector] || null; }
  }
  const listeners = {};
  const footer = new Element('footer');
  const document = {
    head: new Element('head'), body: new Element('body'), activeElement: null,
    createElement: tag => new Element(tag), contains: element => Boolean(element),
    querySelector: selector => selector === '.footer-inner' ? footer : null,
    addEventListener: (name, fn) => (listeners[name] ||= []).push(fn)
  };
  const saved = new Map();
  if (options.saved) saved.set('checkered-flag-consent-v1', options.saved);
  const window = {
    CHECKERED_FLAG_TRACKING_CONFIG: config,
    localStorage: {
      getItem(key) { if (options.storageBlocked) throw Error('Storage blocked'); return saved.get(key) || null; },
      setItem(key, value) { if (options.storageBlocked) throw Error('Storage blocked'); saved.set(key, value); }
    }
  };
  if (options.gtag) window.gtag = options.gtag;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const sandbox = vm.createContext({ window, document, Date: Clock, URL, Set, Boolean, Infinity });
  const run = () => vm.runInContext(source, sandbox);
  run();
  const click = (location = 'hero', nested = false, additions = {}) => {
    let prevented = false;
    const link = { getAttribute: name => name === 'data-call-location' ? location : 'tel:+12253554920' };
    const target = { closest: selector => selector === 'a[href^="tel:"]' ? link : null };
    const event = { target: nested ? { parentElement: target } : target, button: 0, defaultPrevented: false,
      preventDefault() { prevented = true; }, ...additions };
    (listeners.click || []).forEach(fn => fn(event));
    return { prevented, event };
  };
  return { window, document, listeners, run, click, footer, saved,
    api: window.CheckeredFlagTracking, advance: ms => { clock += ms; },
    commands: () => (window.dataLayer || []).map(args => Array.from(args)),
    events: () => (window.dataLayer || []).map(args => Array.from(args)).filter(args => args[0] === 'event') };
}

test('missing, blank, and malformed identifiers load no tags, controls, or listeners', () => {
  for (const config of [undefined, {}, { ga4MeasurementId: '', googleAdsConversionId: '' }, { ga4MeasurementId: 'bad', googleAdsConversionId: 'AW-bad', googleAdsConversionLabel: 'bad/label' }]) {
    const f = fixture(config);
    assert.equal(f.api.getState().configured, false);
    f.api.setConsent({ analytics: true, advertising: true });
    assert.equal(f.document.head.children.length, 0);
    assert.equal(f.document.body.children.length, 0);
    assert.equal(f.listeners.click, undefined);
    assert.equal(f.click().prevented, false);
  }
});

test('configured tags and phone events stay blocked until explicit consent', () => {
  const f = fixture(ids);
  f.click();
  assert.equal(f.document.head.children.length, 0);
  assert.equal(f.events().length, 0);
  f.api.setConsent({ analytics: false, advertising: false });
  f.click();
  assert.equal(f.document.head.children.length, 0);
  f.api.setConsent({ analytics: 'true', advertising: 1 });
  assert.equal(f.document.head.children.length, 0);
});

test('consent initializes defaults before configs and loads one remote tag', () => {
  const f = fixture(ids);
  f.api.setConsent({ analytics: true, advertising: true });
  f.api.setConsent({ analytics: true, advertising: true });
  const commands = f.commands();
  assert.equal(commands[0][0], 'consent');
  assert.equal(commands[0][1], 'default');
  assert.equal(commands[0][2].analytics_storage, 'denied');
  assert.equal(f.document.head.children.length, 1);
  assert.match(f.document.head.children[0].src, /gtag\/js\?id=G-TEST0001$/);
  assert.equal(commands.filter(c => c[0] === 'config').length, 2);
  assert.equal(commands.filter(c => c[0] === 'consent' && c[1] === 'update').at(-1)[2].ad_personalization, 'denied');
});

test('one nested-link activation emits exactly one event per destination without delaying dialing', () => {
  const f = fixture(ids);
  f.api.setConsent({ analytics: true, advertising: true });
  f.run(); // Duplicate script inclusion must not add another listener.
  assert.equal(f.listeners.click.length, 1);
  assert.equal(f.click('engine-service', true).prevented, false);
  assert.equal(f.events().length, 2);
  assert.equal(f.events()[0][1], 'phone_call_click');
  assert.equal(f.events()[0][2].send_to, ids.ga4MeasurementId);
  assert.equal(f.events()[0][2].link_location, 'engine-service');
  assert.equal(f.events()[1][1], 'conversion');
  assert.equal(f.events()[1][2].send_to, 'AW-123456789/TestLabel');
  f.click('contact'); // Rapid second tap is deduplicated across links.
  assert.equal(f.events().length, 2);
  f.advance(1600);
  f.click('contact');
  assert.equal(f.events().length, 4);
});

test('analytics-only and advertising-only consent never cross-send phone events', () => {
  for (const analytics of [true, false]) {
    const f = fixture(ids);
    f.api.setConsent({ analytics, advertising: !analytics });
    f.click();
    assert.equal(f.events().length, 1);
    assert.equal(f.events()[0][1], analytics ? 'phone_call_click' : 'conversion');
    assert.equal(f.commands().filter(c => c[0] === 'config').length, 1);
  }
});

test('withdrawal stops further phone events and updates Google consent', () => {
  const f = fixture(ids);
  f.api.setConsent({ analytics: true, advertising: true });
  f.click(); f.advance(1600);
  f.api.setConsent({ analytics: false, advertising: false });
  f.click();
  assert.equal(f.events().length, 2);
  const update = f.commands().filter(c => c[0] === 'consent' && c[1] === 'update').at(-1);
  assert.equal(update[2].analytics_storage, 'denied');
  assert.equal(update[2].ad_storage, 'denied');
});

test('storage restrictions, malformed choices, and throwing external tags fail safely', () => {
  const f = fixture(ids, { storageBlocked: true, gtag: () => { throw Error('Blocked tag'); } });
  assert.doesNotThrow(() => f.api.setConsent({ analytics: true, advertising: true }));
  assert.doesNotThrow(() => f.click());
  assert.equal(f.click().prevented, false);
  const corrupt = fixture(ids, { saved: '{broken' });
  assert.equal(corrupt.document.head.children.length, 0);
});

test('remembered consent matches destinations, expires, and is not replayed from future timestamps', () => {
  const signature = 'G-TEST0001|AW-123456789|TestLabel';
  const choice = { signature, analytics: true, advertising: false, savedAt: 2000000000000 };
  const f = fixture(ids, { saved: JSON.stringify(choice) });
  assert.equal(f.document.head.children.length, 1);
  f.click(); assert.equal(f.events().length, 1);
  for (const change of [{ signature: 'different' }, { savedAt: 0 }, { savedAt: 2000000000001 }]) {
    const fresh = fixture(ids, { saved: JSON.stringify({ ...choice, ...change }) });
    assert.equal(fresh.document.head.children.length, 0);
  }
});

test('ignored non-link, right-button, and cancelled events never become conversions', () => {
  const f = fixture(ids);
  f.api.setConsent({ analytics: true, advertising: true });
  f.click('hero', false, { defaultPrevented: true });
  f.click('hero', false, { button: 2 });
  f.click('hero', false, { target: { closest: () => null } });
  assert.equal(f.events().length, 0);
});

test('consent UI saves separate choices, reopens, and can decline', () => {
  const f = fixture(ids);
  const panel = f.document.body.children[0];
  assert.equal(panel.hidden, false);
  panel.querySelector('[name=analytics]').checked = true;
  panel.querySelector('[name=advertising]').checked = false;
  panel.querySelector('form').listeners.submit({ preventDefault() {} });
  assert.equal(panel.hidden, true);
  assert.equal(f.api.getState().analytics, true);
  assert.equal(f.api.getState().advertising, false);
  f.api.openPreferences();
  assert.equal(panel.hidden, false);
  assert.equal(f.document.activeElement, panel.querySelector('h2'));
  panel.querySelector('.measurement-decline').listeners.click();
  assert.equal(panel.hidden, true);
  assert.equal(f.api.getState().analytics, false);
});
