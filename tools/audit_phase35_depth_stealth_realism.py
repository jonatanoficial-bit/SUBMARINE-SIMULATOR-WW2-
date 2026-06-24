#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks=[]
def ok(name, condition):
    checks.append((name,bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase35 depth stealth realism audit: {name}')
def read(path): return (ROOT/path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
module=read('js/systems/depthStealthRealism.js'); gameplay=read('js/screens/gameplay.js'); css=read('css/phase35-depth-stealth-realism.css'); index=read('index.html'); sw=read('service-worker.js'); smoke=read('tests/smoke_test.py')
ok('build version alpha50', build.get('version')=='v2.0.0-alpha.50')
ok('build phase 35', build.get('phase')=='35')
ok('save schema 29', build.get('saveSchemaVersion')==29)
ok('package version alpha50', pkg.get('version')=='2.0.0-alpha.50')
ok('manifest version alpha50', manifest.get('version')=='2.0.0-alpha.50')
ok('package audit phase35', pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase35_depth_stealth_realism.py')
ok('package test phase35', 'phase35_depth_stealth_realism.test.js' in pkg.get('scripts',{}).get('test',''))
ok('module metadata', 'PHASE35_DEPTH_STEALTH' in module and "system: 'depth-stealth-realism'" in module)
ok('module view and escalation', 'buildDepthStealthView' in module and 'shouldDepthStealthEscalate' in module)
ok('module stealth logic', all(t in module for t in ['thermalLayer','layerShield','acousticLeak','cavitationState','pressureState']))
ok('gameplay import', '../systems/depthStealthRealism.js' in gameplay)
ok('gameplay ready class', 'phase35-depth-stealth-ready' in gameplay)
ok('gameplay panel ids', all(t in gameplay for t in ['phase35-depth-stealth','phase35-thermal-layer-line','phase35-acoustic-leak','updateDepthStealth']))
ok('css visual elements', all(t in css for t in ['phase35-depth-map','phase35-thermal-layer','phase35-sub-depth','phase35-stealth-grid']))
ok('css mobile breakpoints', '@media (max-width:760px)' in css and '@media (max-width:420px)' in css)
ok('index links css', 'css/phase35-depth-stealth-realism.css' in index)
ok('service worker bumped', '2.0.0-alpha.50' in sw)
ok('service worker caches assets', 'phase35-depth-stealth-realism.css' in sw and 'depthStealthRealism.js' in sw)
ok('smoke has assets', 'phase35-depth-stealth-realism.css' in smoke and 'depthStealthRealism.js' in smoke)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['depthStealth.kicker','depthStealth.level.critical','depthStealth.layer.below','depthStealth.adviceCritical']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase35 depth stealth realism audit: {len(checks)} checks')
