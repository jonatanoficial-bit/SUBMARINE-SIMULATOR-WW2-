#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
required = [
    'index.html', 'manifest.json', 'service-worker.js', 'BUILD_INFO.json', 'js/build.js',
    'js/app.js', 'js/components/ui.js', 'js/screens/bridge.js', 'css/phase14-bridge-instruments.css',
    'tests/bridge_instruments.test.js', 'data/translations/pt-BR.json', 'data/translations/en.json', 'data/translations/es.json',
]
checks = []

def ok(name, condition, detail=''):
    checks.append({'name': name, 'pass': bool(condition), 'detail': detail})

for rel in required:
    ok(f'required file {rel}', (ROOT / rel).exists())

build = json.loads((ROOT / 'BUILD_INFO.json').read_text(encoding='utf-8'))
ok('phase is 14', build.get('phase') == '14')
ok('version is alpha 14', build.get('version') == 'v2.0.0-alpha.14')
ok('schema migrated to 6', build.get('saveSchemaVersion') == 6)

index = (ROOT / 'index.html').read_text(encoding='utf-8')
ok('phase14 css linked', 'css/phase14-bridge-instruments.css' in index)
ok('index title updated', 'v2.0.0-alpha.14' in index)

app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
ok('bridge screen imported', "./screens/bridge.js" in app)
ok('bridge screen registered', ".register('bridge'" in app)
ok('bridge screen protected by save guard', "'bridge'" in app and 'menu.noSave' in app)
ok('bridge background assigned', "bridge: 'submarine_control_room'" in app)

ui = (ROOT / 'js/components/ui.js').read_text(encoding='utf-8')
ok('bottom nav includes bridge', "id: 'bridge'" in ui)

screen = (ROOT / 'js/screens/bridge.js').read_text(encoding='utf-8')
for token in ['createBridgeTelemetry', 'bridge-digital', 'writeNeedle', 'oxygen', 'battery', 'noise', 'detection', 'data-bridge-command="${mode}"']:
    ok(f'bridge contains {token}', token in screen)

css = (ROOT / 'css/phase14-bridge-instruments.css').read_text(encoding='utf-8')
for token in ['.bridge-dial', '.needle', '.bridge-digital', '@media(max-width:700px)', 'grid-template-columns:repeat(8']:
    ok(f'phase14 css contains {token}', token in css)

sw = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
ok('service worker cache bumped', "2.0.0-alpha.14" in sw)
ok('service worker caches bridge JS', './js/screens/bridge.js' in sw)
ok('service worker caches phase14 CSS', './css/phase14-bridge-instruments.css' in sw)

translations = {lang: json.loads((ROOT / f'data/translations/{lang}.json').read_text(encoding='utf-8')) for lang in ['pt-BR', 'en', 'es']}
base_keys = set(translations['pt-BR'])
for lang, data in translations.items():
    ok(f'{lang} key parity', set(data) == base_keys)
    for key in ['nav.bridge', 'bridge.subtitle', 'bridge.depth', 'bridge.oxygen', 'bridge.mode.emergency']:
        ok(f'{lang} has {key}', key in data and bool(data[key]))

failures = [c for c in checks if not c['pass']]
report_dir = ROOT / 'reports'
report_dir.mkdir(exist_ok=True)
(report_dir / 'phase14_audit.json').write_text(json.dumps({'checks': checks, 'failures': failures}, indent=2, ensure_ascii=False), encoding='utf-8')
if failures:
    for item in failures:
        print(f"FAIL: {item['name']} {item['detail']}")
    raise SystemExit(1)
print(f"PHASE14 AUDIT PASS: {len(checks)}/{len(checks)} checks")
