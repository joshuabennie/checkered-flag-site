"""Dependency-free checks for this GitHub Pages project's SEO and asset contract."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://joshuabennie.github.io/checkered-flag-site/'

class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.headings = []
        self.active_heading = None
        self.schema_text = ''
        self.in_schema = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.active_heading = [int(tag[1]), '']
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.in_schema = True
    def handle_data(self, data):
        if self.active_heading is not None:
            self.active_heading[1] += data
        if self.in_schema:
            self.schema_text += data
    def handle_endtag(self, tag):
        if self.active_heading is not None and tag == f'h{self.active_heading[0]}':
            self.headings.append(self.active_heading)
            self.active_heading = None
        if tag == 'script':
            self.in_schema = False

html = (ROOT / 'index.html').read_text(encoding='utf-8')
def asset_version(path):
    # Git may convert LF/CRLF between GitHub Pages and Windows checkouts.
    return hashlib.sha256(path.read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]

if '--update-versions' in sys.argv:
    for name in ('styles.css', 'tracking-config.js', 'tracking.js'):
        html = re.sub(re.escape(name) + r'\?v=[a-f0-9]+', name + '?v=' + asset_version(ROOT / name), html)
    (ROOT / 'index.html').write_text(html, encoding='utf-8')

site = SiteParser()
site.feed(html)
assert [text.strip() for level, text in site.headings if level == 1] == ['Engine & Transmission Repair in Baton Rouge']
prior = 0
for level, text in site.headings:
    assert level <= prior + 1, f'Skipped heading level: {text}'
    prior = level
assert 'Honest work.<br>Reliable repairs.<br><em>Back on the road.</em>' in html
assert 'Engine &amp; Transmission Repair Baton Rouge | Checkered Flag' in html
meta = {attrs.get('name', attrs.get('property')): attrs.get('content') for tag, attrs in site.elements if tag == 'meta'}
assert len(meta['description']) <= 160
assert meta['robots'] == 'index, follow, max-image-preview:large'
assert meta['og:url'] == URL
assert meta['og:title'] == meta['twitter:title']
assert meta['og:description'] == meta['description'] == meta['twitter:description']
assert meta['og:image'].startswith(URL)
assert meta['twitter:card'] == 'summary_large_image'
assert any(tag == 'link' and attrs.get('rel') == 'canonical' and attrs.get('href') == URL for tag, attrs in site.elements)
ids = [attrs['id'] for _, attrs in site.elements if 'id' in attrs]
assert len(ids) == len(set(ids)), 'Duplicate IDs'
phones = []
images = []
for tag, attrs in site.elements:
    if tag == 'a':
        href = attrs.get('href', '')
        assert not href.startswith('mailto:')
        if href.startswith('#'):
            assert href[1:] in ids, f'Broken fragment {href}'
        if href.startswith('tel:'):
            assert href == 'tel:+12253554920'
            assert attrs.get('data-call-location')
            phones.append(attrs['data-call-location'])
        if attrs.get('target') == '_blank':
            assert 'noopener' in attrs.get('rel', '')
    if tag == 'img':
        assert attrs.get('alt') and attrs.get('width') and attrs.get('height')
        assert attrs.get('loading') == 'lazy'
        images.append(attrs)
    resource = attrs.get('src') if tag in ('script', 'img') else attrs.get('href') if tag == 'link' and attrs.get('rel') == 'stylesheet' else None
    if resource:
        parsed = urlparse(resource)
        assert not parsed.scheme and not resource.startswith('/'), f'Non-project-relative asset: {resource}'
        path = ROOT / unquote(parsed.path)
        assert path.is_file(), f'Missing asset: {resource}'
        if path.suffix in ('.css', '.js'):
            assert parsed.query == 'v=' + asset_version(path), f'Stale asset version: {resource}; run python tests/check_site.py --update-versions'
        if path.suffix == '.js':
            assert 'defer' in attrs
assert len(phones) == 8 and len(set(phones)) == 8
assert len(images) == 4
schema = json.loads(site.schema_text)
assert schema['@context'] == 'https://schema.org' and schema['@type'] == 'AutoRepair'
assert schema['url'] == URL and schema['telephone'] == '+12253554920'
assert schema['address'] == {'@type': 'PostalAddress', 'streetAddress': '1777 N Foster Dr', 'addressLocality': 'Baton Rouge', 'addressRegion': 'LA', 'postalCode': '70806', 'addressCountry': 'US'}
assert not {'openingHours', 'openingHoursSpecification', 'aggregateRating', 'review', 'priceRange', 'warranty'}.intersection(schema)
offers = schema['hasOfferCatalog']['itemListElement']
assert len(offers) == 7
for offer in offers:
    assert offer['@type'] == 'Offer' and offer['itemOffered']['@type'] == 'Service'
    assert offer['itemOffered']['provider']['@id'] == schema['@id']
urls = ET.parse(ROOT / 'sitemap.xml').findall('{http://www.sitemaps.org/schemas/sitemap/0.9}url')
assert len(urls) == 1 and urls[0].find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc').text == URL
config = (ROOT / 'tracking-config.js').read_text(encoding='utf-8')
for key, pattern in [('ga4MeasurementId', r'G-[A-Z0-9]+'), ('googleAdsConversionId', r'AW-\d+'), ('googleAdsConversionLabel', r'[A-Za-z0-9_-]+')]:
    value = re.search(rf'{key}:\s*"([^"]*)"', config).group(1)
    assert not value or re.fullmatch(pattern, value), f'Malformed tracking identifier: {key}'
assert 'gtag(' not in html and 'onclick=' not in html
print(f'PASS: metadata, 1 H1, heading hierarchy, schema, sitemap, {len(phones)} telephone links, {len(images)} photos, relative assets, content hashes, and tracking identifier syntax.')
