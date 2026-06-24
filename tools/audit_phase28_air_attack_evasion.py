#!/usr/bin/env python3
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
checks=[]
def ok(name, condition, detail=''):
    if not condition:
        raise SystemExit(f'FAIL: {name} {detail}')
    checks.append(name)
def read(path): return (root/path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
index=read('index.html'); sw=read('service-worker.js'); gameplay=read('js/screens/gameplay.js'); module=read('js/systems/airAttackEvasion.js'); css=read('css/phase28-air-attack-evasion.css'); smoke=read('tests/smoke_test.py')
ok('build version', build.get('version') == 'v2.0.0-alpha.43')
ok('phase id', build.get('phase') == '28')
ok('save schema', int(build.get('saveSchemaVersion')) == 22)
ok('package version', pkg.get('version') == '2.0.0-alpha.43')
ok('manifest version', manifest.get('version') == '2.0.0-alpha.43')
ok('audit script active', pkg['scripts']['audit'] == 'python3 tools/audit_phase28_air_attack_evasion.py')
ok('phase28 test in package', 'phase28_air_attack_evasion.test.js' in pkg['scripts']['test'])
for path in ['js/systems/airAttackEvasion.js','css/phase28-air-attack-evasion.css','tests/phase28_air_attack_evasion.test.js']:
    ok(f'{path} exists', (root/path).exists())
ok('index links phase28 css', 'css/phase28-air-attack-evasion.css' in index)
ok('service worker caches phase28 css', './css/phase28-air-attack-evasion.css' in sw)
ok('service worker caches phase28 module', './js/systems/airAttackEvasion.js' in sw)
ok('smoke imports phase28 module', 'js/systems/airAttackEvasion.js' in smoke)
ok('smoke loads phase28 css', 'css/phase28-air-attack-evasion.css' in smoke)
ok('gameplay imports phase28 module', 'airAttackEvasion.js' in gameplay)
ok('gameplay renders air panel', 'phase28-air-attack-panel' in gameplay and 'phase28-air-marker' in gameplay)
ok('gameplay has evasion buttons', all(token in gameplay for token in ['air-evasion-dive','air-evasion-silent','air-evasion-hold']))
ok('gameplay updates air each tick', 'updateAirAttackEvasion(snapshot)' in gameplay)
ok('gameplay keeps f24 f25 f26 f27 classes', all(token in gameplay for token in ['phase24', 'phase25-command-room-shell', 'phase26-subofficer-ready', 'phase27-alert-atmosphere-ready']))
ok('module exposes phase marker', 'PHASE28_AIR_ATTACK_EVASION' in module and 'air-attack-evasion' in module)
ok('module classifies attack levels', all(token in module for token in ['standby', 'patrol', 'tracking', 'attack']))
ok('module recommends decisions', all(token in module for token in ['recommendAirEvasionAction','dive','silent','hold']))
ok('module computes marker style', 'markerStyle' in module and '--phase28-air-x' in module and '--phase28-air-y' in module)
ok('css has mobile layout', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('css has attack animation', 'phase28AirPulse' in css and 'phase28AircraftBlink' in css)
ok('css has radar and actions', all(token in css for token in ['phase28-air-radar','phase28-air-actions','air-dive','air-silent','air-hold']))
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['airAttack.kicker','airAttack.title.attack','airAttack.message.tracking','airAttack.action.dive','airAttack.action.silent','airAttack.recommend.dive','subofficer.msg.aircraftAttack']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase28 air attack evasion audit: {len(checks)} checks')
