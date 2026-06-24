#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks=[]
def ok(name, condition):
    checks.append((name,bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase34 damage visual states audit: {name}')
def read(path): return (ROOT/path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
module=read('js/systems/submarineDamageVisuals.js'); gameplay=read('js/screens/gameplay.js'); css=read('css/phase34-damage-visual-states.css'); index=read('index.html'); sw=read('service-worker.js'); smoke=read('tests/smoke_test.py')
ok('build version alpha49', build.get('version')=='v2.0.0-alpha.49')
ok('build phase 34', build.get('phase')=='34')
ok('save schema 28', build.get('saveSchemaVersion')==28)
ok('package version alpha49', pkg.get('version')=='2.0.0-alpha.49')
ok('manifest version alpha49', manifest.get('version')=='2.0.0-alpha.49')
ok('package audit phase34', pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase34_damage_visual_states.py')
ok('package test phase34', 'phase34_damage_visual_states.test.js' in pkg.get('scripts',{}).get('test',''))
ok('module metadata', 'PHASE34_SUBMARINE_DAMAGE_VISUALS' in module and "system: 'submarine-damage-visual-states'" in module)
ok('module view function', 'buildSubmarineDamageVisualView' in module and 'shouldDamageVisualEscalate' in module)
ok('module severity logic', all(t in module for t in ['critical','emergency','flooded','breached','crewCritical']))
ok('gameplay import', '../systems/submarineDamageVisuals.js' in gameplay)
ok('gameplay ready class', 'phase34-damage-visual-ready' in gameplay)
ok('gameplay panel ids', all(t in gameplay for t in ['phase34-damage-visual','phase34-hull-cutaway','phase34-room-strip','updateDamageVisuals']))
ok('css visual elements', all(t in css for t in ['phase34-hull-cutaway','phase34-room','phase34-smoke','phase34-sparks']))
ok('css mobile breakpoints', '@media (max-width:760px)' in css and '@media (max-width:420px)' in css)
ok('index links css', 'css/phase34-damage-visual-states.css' in index)
ok('service worker bumped', '2.0.0-alpha.49' in sw)
ok('service worker caches assets', 'phase34-damage-visual-states.css' in sw and 'submarineDamageVisuals.js' in sw)
ok('smoke has assets', 'phase34-damage-visual-states.css' in smoke and 'submarineDamageVisuals.js' in smoke)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['damageVisual.kicker','damageVisual.severity.critical','damageVisual.crewCritical','damageVisual.room.flooded']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase34 damage visual states audit: {len(checks)} checks')
