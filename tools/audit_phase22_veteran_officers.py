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
data = load('data/veteran_officers.json')
pt = load('data/translations/pt-BR.json')
en = load('data/translations/en.json')
es = load('data/translations/es.json')

ok('build version', build.get('version') == 'v2.0.0-alpha.37')
ok('phase id', build.get('phase') == '22')
ok('save schema', int(build.get('saveSchemaVersion')) == 16)
ok('package version', pkg.get('version') == '2.0.0-alpha.37')
ok('data coverage', len(data) == 3)
required_nations = {'de','uk','us'}
ok('nations coverage', {deck.get('nationId') for deck in data} == required_nations)
ids = set()
for deck in data:
    ok(f'{deck["nationId"]} officer count', len(deck.get('officers', [])) == 4)
    for officer in deck['officers']:
        ok(f'unique officer {officer["id"]}', officer['id'] not in ids)
        ids.add(officer['id'])
        for key in ['credits','commandPoints']:
            ok(f'{officer["id"]} cost {key}', isinstance(officer.get('cost', {}).get(key), (int, float)))
        for key in ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta','sonarBonus','engineeringBonus','torpedoBonus','stealthBonus']:
            ok(f'{officer["id"]} effect {key}', isinstance(officer.get('effect', {}).get(key), (int, float)))
        for key in [officer['nameKey'], officer['roleKey'], officer['descKey'], officer['specialtyKey']]:
            ok(f'translation pt {key}', key in pt)
            ok(f'translation en {key}', key in en)
            ok(f'translation es {key}', key in es)
for path in ['js/systems/veteranOfficers.js','css/phase22-veteran-officers.css','tests/phase22_veteran_officers.test.js']:
    ok(f'{path} exists', (root / path).exists())
ok('package test includes phase22', 'phase22_veteran_officers.test.js' in pkg['scripts']['test'])
ok('service worker caches data', 'data/veteran_officers.json' in (root / 'service-worker.js').read_text(encoding='utf-8'))
print(f'PASS: {len(checks)} checks')
