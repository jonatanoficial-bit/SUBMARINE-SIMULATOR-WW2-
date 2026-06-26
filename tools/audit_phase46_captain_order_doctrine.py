#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks = []
def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase46 captain order doctrine audit: {name}')
def read(path): return (ROOT / path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
module=read('js/systems/captainOrderDoctrine.js'); sub=read('js/systems/subOfficerCopilot.js'); gameplay=read('js/screens/gameplay.js')
css=read('css/phase46-captain-order-doctrine.css'); index=read('index.html'); sw=read('service-worker.js'); smoke=read('tests/smoke_test.py')
ok('version alpha61', build.get('version') == 'v2.0.0-alpha.61')
ok('phase 46', build.get('phase') == '46')
ok('schema 40', build.get('saveSchemaVersion') == 40)
ok('package alpha61', pkg.get('version') == '2.0.0-alpha.61')
ok('manifest alpha61', manifest.get('version') == '2.0.0-alpha.61')
ok('audit script active', pkg.get('scripts',{}).get('audit') == 'python3 tools/audit_phase46_captain_order_doctrine.py')
ok('phase46 test active', 'phase46_captain_order_doctrine.test.js' in pkg.get('scripts',{}).get('test',''))
ok('module exports doctrine view', 'PHASE46_CAPTAIN_ORDER_DOCTRINE' in module and 'buildCaptainOrderDoctrineView' in module)
ok('module defines captain philosophy', 'captain-decides-crew-operates' in module and 'manualOverride' in module)
ok('module never directly fires torpedo in attack action', 'prepare-attack' in module and 'fire-torpedo' not in module)
ok('subofficer imports doctrine', 'captainOrderDoctrine.js' in sub and 'captainDecision' in sub)
ok('subofficer uses attack question', 'captainOrder.question.attackReady' in sub and 'prepare-attack' in sub)
ok('gameplay has command mode UI', 'phase46-command-mode-card' in gameplay and 'captainCommandMode' in gameplay)
ok('gameplay supports manual override', "setCaptainCommandMode('manual')" in gameplay and 'captainAllowsPopup' in gameplay)
ok('gameplay maps crew orders', all(token in gameplay for token in ['prepare-attack','evade-now','authorize-repair','plan-patrol']))
ok('css has mobile support', '@media (max-width: 760px)' in css and 'phase46-command-mode-card' in css)
ok('index links css', 'css/phase46-captain-order-doctrine.css' in index)
ok('sw caches css and module', 'phase46-captain-order-doctrine.css' in sw and 'captainOrderDoctrine.js' in sw)
ok('smoke includes css and module', 'phase46-captain-order-doctrine.css' in smoke and 'captainOrderDoctrine.js' in smoke)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['captainOrder.question.attackReady','captainOrder.action.prepareAttack','captainOrder.mode.manual']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase46 captain order doctrine audit: {len(checks)} checks')
