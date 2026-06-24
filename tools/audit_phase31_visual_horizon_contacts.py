#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase31 visual horizon contacts audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/visualHorizonContacts.js')
gameplay = read('js/screens/gameplay.js')
css = read('css/phase31-visual-horizon-contacts.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha46', build.get('version') == 'v2.0.0-alpha.47')
ok('build phase 31', build.get('phase') == '32')
ok('save schema 25', V)
ok('package version alpha46', pkg.get('version') == '2.0.0-alpha.47')
ok('manifest version alpha46', manifest.get('version') == '2.0.0-alpha.47')
ok('package audit script points to phase31', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase31_visual_horizon_contacts.py')
ok('package includes phase31 test', 'phase31_visual_horizon_contacts.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE31_VISUAL_HORIZON_CONTACTS' in module and "system: 'visual-horizon-contacts'" in module)
ok('module builds horizon view', 'buildHorizonContactView' in module and 'smokeCount' in module and 'mastCount' in module)
ok('module handles aircraft contacts', 'buildAircraftContact' in module and 'horizonContacts.reportAircraft' in module)
ok('gameplay imports horizon contacts', '../systems/visualHorizonContacts.js' in gameplay)
ok('gameplay has phase31 ready class', 'phase31-visual-horizon-ready' in gameplay)
ok('gameplay has horizon layer and report', all(token in gameplay for token in ['phase31-horizon-contact-layer','phase31-horizon-report','updateHorizonContacts']))
ok('css has contact silhouette style', all(token in css for token in ['phase31-horizon-contact','phase31-smoke','phase31-masts','phase31-horizon-report']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase31-visual-horizon-contacts.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.47' in sw)
ok('service worker caches css and module', 'phase31-visual-horizon-contacts.css' in sw and 'visualHorizonContacts.js' in sw)
ok('smoke has css and module', 'phase31-visual-horizon-contacts.css' in smoke and 'visualHorizonContacts.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['horizonContacts.kicker','horizonContacts.reportClear','horizonContacts.reportTarget','horizonContacts.reportAircraft']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase31 visual horizon contacts audit: {len(checks)} checks')
