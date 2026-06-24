#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition, detail=''):
    if not condition:
        raise SystemExit(f'FAIL: {name} {detail}')
    checks.append(name)

def load(path):
    return json.loads((root / path).read_text(encoding='utf-8'))

build = load('BUILD_INFO.json')
pkg = load('package.json')
data = load('data/crew_drills.json')
pt = load('data/translations/pt-BR.json')
en = load('data/translations/en.json')
es = load('data/translations/es.json')

ok('build version', build.get('version') == 'v2.0.0-alpha.39')
ok('phase id', build.get('phase') == '24')
ok('save schema', int(build.get('saveSchemaVersion')) == 18)
ok('package version', pkg.get('version') == '2.0.0-alpha.39')
ok('data coverage', len(data) == 3)
required_nations = {'de', 'uk', 'us'}
ok('nations coverage', {deck.get('nationId') for deck in data} == required_nations)
ids = set()
for deck in data:
    ok(f'{deck["nationId"]} drill count', len(deck.get('drills', [])) == 4)
    for drill in deck['drills']:
        ok(f'unique drill {drill["id"]}', drill['id'] not in ids)
        ids.add(drill['id'])
        for key in ['credits', 'commandPoints']:
            ok(f'{drill["id"]} cost {key}', isinstance(drill.get('cost', {}).get(key), (int, float)))
        for key in ['readinessBonus', 'moraleBonus', 'fatigueDelta', 'sonarBonus', 'engineeringBonus', 'torpedoBonus', 'stealthBonus', 'intelBonus', 'decryptionBonus', 'pressureRelief', 'riskDelta', 'tonnageMultiplier']:
            ok(f'{drill["id"]} effect {key}', isinstance(drill.get('effect', {}).get(key), (int, float)))
        for key in [drill['nameKey'], drill['descKey'], drill['stationKey']]:
            ok(f'translation pt {key}', key in pt)
            ok(f'translation en {key}', key in en)
            ok(f'translation es {key}', key in es)
for key in ['crewDrills.title', 'crewDrills.heading', 'crewDrills.run', 'toast.crewDrillCompleted']:
    ok(f'translation key {key} pt', key in pt)
    ok(f'translation key {key} en', key in en)
    ok(f'translation key {key} es', key in es)
for path in ['js/systems/crewDrills.js', 'css/phase23-crew-drills.css', 'tests/phase23_crew_drills.test.js']:
    ok(f'{path} exists', (root / path).exists())
ok('package test includes phase23 drill test', 'phase23_crew_drills.test.js' in pkg['scripts']['test'])
ok('service worker caches data', 'data/crew_drills.json' in (root / 'service-worker.js').read_text(encoding='utf-8'))
ok('index links css', 'phase23-crew-drills.css' in (root / 'index.html').read_text(encoding='utf-8'))
print(f'PASS: {len(checks)} checks')
