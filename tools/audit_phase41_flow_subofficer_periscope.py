#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks = []
def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase41 flow/subofficer/periscope audit: {name}')
def read(path): return (ROOT / path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
ui = read('js/components/ui.js')
lobby = read('js/screens/lobby.js')
gameplay = read('js/screens/gameplay.js')
sub = read('js/systems/subOfficerCopilot.js')
css = read('css/phase41-flow-subofficer-periscope.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
ok('build version alpha56', build.get('version') == 'v2.0.0-alpha.56')
ok('phase 41 active', build.get('phase') == '41')
ok('save schema 35', build.get('saveSchemaVersion') == 35)
ok('package version alpha56', pkg.get('version') == '2.0.0-alpha.56')
ok('manifest version alpha56', manifest.get('version') == '2.0.0-alpha.56')
ok('package audit phase41', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase41_flow_subofficer_periscope.py')
ok('test included', 'phase41_flow_subofficer_periscope.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('bottom nav simplified', 'nav.mission' in ui and 'nav.baseWorkshop' in ui and 'nav.strategy' not in ui)
ok('lobby flow hub', 'phase41-flow-hub' in lobby and 'flow.missionDesc' in lobby)
ok('gameplay phase41 classes', 'phase41-mission-flow-ready' in gameplay and 'phase41-subofficer-guide-ready' in gameplay)
ok('subofficer toggle wired', 'subofficer-toggle' in gameplay and 'openSubOfficerFromToggle' in gameplay)
ok('subofficer actions wired', 'subofficer-quick-actions' in gameplay and 'runSubOfficerAction' in gameplay and 'data-subofficer-action' in gameplay)
ok('subofficer captain ready logic', 'crew-ready-awaiting-orders' in sub and 'crewReadyCaptain' in sub)
ok('subofficer route guidance logic', 'route-needed' in sub and 'routeNeeded' in sub)
ok('mobile periscope hides letters', 'periscope-data-ribbon' in css and 'phase18-periscope-solution' in css and 'phase31-horizon-report' in css and 'display: none !important' in css)
ok('mobile periscope larger shell', 'calc(100svh - 42px)' in css)
ok('css linked in index', 'phase41-flow-subofficer-periscope.css' in index)
ok('css cached in sw', 'phase41-flow-subofficer-periscope.css' in sw)
ok('css in smoke', 'phase41-flow-subofficer-periscope.css' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['nav.mission','flow.mission','subofficer.msg.crewReadyCaptain','subofficer.msg.routeNeeded','subofficer.action.periscope']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase41 flow/subofficer/periscope audit: {len(checks)} checks')
