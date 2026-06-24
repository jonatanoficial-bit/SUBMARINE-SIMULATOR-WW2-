#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase32 torpedo attack director audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/torpedoAttackDirector.js')
gameplay = read('js/screens/gameplay.js')
css = read('css/phase32-torpedo-attack-director.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha47', build.get('version') == 'v2.0.0-alpha.47')
ok('build phase 32', build.get('phase') == '32')
ok('save schema 26', build.get('saveSchemaVersion') == 26)
ok('package version alpha47', pkg.get('version') == '2.0.0-alpha.47')
ok('manifest version alpha47', manifest.get('version') == '2.0.0-alpha.47')
ok('package audit script points to phase32', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase32_torpedo_attack_director.py')
ok('package includes phase32 test', 'phase32_torpedo_attack_director.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE32_TORPEDO_ATTACK_DIRECTOR' in module and "system: 'torpedo-attack-director'" in module)
ok('module builds attack director view', 'buildTorpedoAttackDirectorView' in module and 'recommendationKey' in module and 'runProgress' in module)
ok('module handles launch constraints', 'recommendDepth' in module and 'recommendCloseRange' in module and 'recommendFire' in module)
ok('gameplay imports torpedo director', '../systems/torpedoAttackDirector.js' in gameplay)
ok('gameplay has phase32 ready class', 'phase32-torpedo-attack-ready' in gameplay)
ok('gameplay has director panel ids', all(token in gameplay for token in ['phase32-attack-director','phase32-attack-plot','phase32-fire-order','updateTorpedoAttackDirector']))
ok('css has attack plot and bars', all(token in css for token in ['phase32-attack-plot','phase32-torpedo-run','phase32-bar','phase32-director-order']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase32-torpedo-attack-director.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.47' in sw)
ok('service worker caches css and module', 'phase32-torpedo-attack-director.css' in sw and 'torpedoAttackDirector.js' in sw)
ok('smoke has css and module', 'phase32-torpedo-attack-director.css' in smoke and 'torpedoAttackDirector.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['torpedoDirector.kicker','torpedoDirector.phaseAcquire','torpedoDirector.recommendFire','torpedoDirector.shotNone']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase32 torpedo attack director audit: {len(checks)} checks')
