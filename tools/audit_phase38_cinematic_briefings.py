#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase38 cinematic briefings audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/cinematicBriefing.js')
briefing = read('js/screens/briefing.js')
css = read('css/phase38-cinematic-briefing.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha53', build.get('version') == 'v2.0.0-alpha.53')
ok('build phase 38', build.get('phase') == '38')
ok('save schema 32', build.get('saveSchemaVersion') == 32)
ok('package version alpha53', pkg.get('version') == '2.0.0-alpha.53')
ok('manifest version alpha53', manifest.get('version') == '2.0.0-alpha.53')
ok('package audit script points to phase38', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase38_cinematic_briefings.py')
ok('package includes phase38 test', 'phase38_cinematic_briefings.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE38_CINEMATIC_BRIEFING' in module and "system: 'cinematic-mission-briefing'" in module)
ok('module builds briefing view', 'buildCinematicBriefing' in module and 'renderCinematicBriefing' in module and 'dossierCode' in module)
ok('module handles risk weather theater', all(token in module for token in ['classifyWeather', 'classifyRisk', 'classifyTheater', 'commanderOrderKey']))
ok('briefing imports cinematic module', '../systems/cinematicBriefing.js' in briefing)
ok('briefing has phase38 ready class', 'phase38-briefing-ready' in briefing)
ok('briefing renders cinematic block', 'renderCinematicBriefing' in briefing and 'buildCinematicBriefing' in briefing)
ok('css has map and board', all(token in css for token in ['phase38-war-map', 'phase38-intel-board', 'phase38-command-order', 'phase38-map-pin']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase38-cinematic-briefing.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.53' in sw)
ok('service worker caches css and module', 'phase38-cinematic-briefing.css' in sw and 'cinematicBriefing.js' in sw)
ok('smoke has css and module', 'phase38-cinematic-briefing.css' in smoke and 'cinematicBriefing.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['briefingCinema.kicker','briefingCinema.riskExtreme','briefingCinema.orderHigh','briefingCinema.pinThreat']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase38 cinematic briefings audit: {len(checks)} checks')
