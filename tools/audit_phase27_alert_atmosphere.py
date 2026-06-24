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
index=read('index.html'); sw=read('service-worker.js'); gameplay=read('js/screens/gameplay.js'); module=read('js/systems/alertAtmosphere.js'); css=read('css/phase27-alert-atmosphere.css'); smoke=read('tests/smoke_test.py')
ok('build version', build.get('version') == 'v2.0.0-alpha.42')
ok('phase id', build.get('phase') == '27')
ok('save schema', int(build.get('saveSchemaVersion')) == 21)
ok('package version', pkg.get('version') == '2.0.0-alpha.42')
ok('manifest version', manifest.get('version') == '2.0.0-alpha.42')
ok('audit script active', pkg['scripts']['audit'] == 'python3 tools/audit_phase27_alert_atmosphere.py')
ok('phase27 test in package', 'phase27_alert_atmosphere.test.js' in pkg['scripts']['test'])
for path in ['js/systems/alertAtmosphere.js','css/phase27-alert-atmosphere.css','tests/phase27_alert_atmosphere.test.js']:
    ok(f'{path} exists', (root/path).exists())
ok('index links phase27 css', 'css/phase27-alert-atmosphere.css' in index)
ok('service worker caches phase27 css', './css/phase27-alert-atmosphere.css' in sw)
ok('service worker caches phase27 module', './js/systems/alertAtmosphere.js' in sw)
ok('smoke imports phase27 module', 'js/systems/alertAtmosphere.js' in smoke)
ok('smoke loads phase27 css', 'css/phase27-alert-atmosphere.css' in smoke)
ok('gameplay imports phase27 module', 'alertAtmosphere.js' in gameplay)
ok('gameplay renders alert panel', 'phase27-alert-atmosphere' in gameplay and 'phase27-alert-label' in gameplay)
ok('gameplay updates alert atmosphere each tick', 'updateAlertAtmosphere(snapshot)' in gameplay)
ok('gameplay updates hud alert dataset', 'hudAlert.dataset.alertLevel' in gameplay)
ok('module exposes phase marker', 'PHASE27_ALERT_ATMOSPHERE' in module and 'alert-atmosphere' in module)
ok('module has five states', all(token in module for token in ['calm', 'suspicion', 'evasion', 'combat', 'emergency']))
ok('module computes score', 'calculateAlertThreatScore' in module and 'detection' in module and 'pressure' in module)
ok('module supports escalation', 'shouldAlertEscalate' in module and 'previous.priority' in module)
ok('css has mobile layout', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('css has alert levels', all(token in css for token in ['data-alert-level="emergency"','data-alert-level="combat"','phase27-alert-lamps']))
ok('css has cinematic pulse', 'phase27-red-wash-pulse' in css and 'phase27-panel-vibration' in css)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['alert.atmosphere.title','alert.level.calm','alert.level.suspicion','alert.level.evasion','alert.level.combat','alert.level.emergency','alert.message.emergency','alert.order.combat']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase27 alert atmosphere audit: {len(checks)} checks')
