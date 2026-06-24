#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks = []
def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase36 cinematic interface audit: {name}')
def read(path): return (ROOT / path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
module=read('js/systems/cinematicInterface.js'); gameplay=read('js/screens/gameplay.js'); css=read('css/phase36-cinematic-interface.css')
index=read('index.html'); sw=read('service-worker.js'); smoke=read('tests/smoke_test.py')
ok('build version alpha51', build.get('version') == 'v2.0.0-alpha.51')
ok('build phase 36', build.get('phase') == '36')
ok('save schema 30', build.get('saveSchemaVersion') == 30)
ok('package version alpha51', pkg.get('version') == '2.0.0-alpha.51')
ok('manifest version alpha51', manifest.get('version') == '2.0.0-alpha.51')
ok('package audit script points to phase36', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase36_cinematic_interface.py')
ok('package includes phase36 test', 'phase36_cinematic_interface.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE36_CINEMATIC_INTERFACE' in module and "system: 'premium-cinematic-interface'" in module)
ok('module builds cinematic view', 'buildCinematicInterfaceView' in module and 'shouldCinematicTransition' in module and 'letterbox' in module)
ok('module handles emergency action success lost', all(token in module for token in ['sceneEmergency','sceneAttackRun','sceneTargetDown','sceneLostBoat']))
ok('gameplay imports cinematic interface', '../systems/cinematicInterface.js' in gameplay)
ok('gameplay has phase36 ready class', 'phase36-cinematic-interface-ready' in gameplay)
ok('gameplay has premium director ids', all(token in gameplay for token in ['phase36-cinematic-layer','phase36-premium-director','phase36-intensity-bar','updateCinematicInterface']))
ok('css has cinematic layer and premium hud', all(token in css for token in ['phase36-cinematic-layer','phase36-premium-director','phase36-letterbox','phase36FilmGrain']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase36-cinematic-interface.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.51' in sw)
ok('service worker caches css and module', 'phase36-cinematic-interface.css' in sw and 'cinematicInterface.js' in sw)
ok('smoke has css and module', 'phase36-cinematic-interface.css' in smoke and 'cinematicInterface.js' in smoke)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['cinematic.kicker','cinematic.sceneAttackRun','cinematic.cueEmergency','cinematic.mode.action']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase36 cinematic interface audit: {len(checks)} checks')
