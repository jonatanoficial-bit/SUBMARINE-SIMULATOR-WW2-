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
index=read('index.html'); sw=read('service-worker.js'); gameplay=read('js/screens/gameplay.js'); module=read('js/systems/subOfficerCopilot.js'); css=read('css/phase26-subofficer-copilot.css'); smoke=read('tests/smoke_test.py')
ok('build version', build.get('version') == 'v2.0.0-alpha.41')
ok('phase id', build.get('phase') == '26')
ok('save schema', int(build.get('saveSchemaVersion')) == 20)
ok('package version', pkg.get('version') == '2.0.0-alpha.41')
ok('manifest version', manifest.get('version') == '2.0.0-alpha.41')
ok('audit script active', pkg['scripts']['audit'] == 'python3 tools/audit_phase26_subofficer_copilot.py')
ok('phase26 test in package', 'phase26_subofficer_copilot.test.js' in pkg['scripts']['test'])
for path in ['js/systems/subOfficerCopilot.js','css/phase26-subofficer-copilot.css','assets/avatars/subofficer_ww2.svg','tests/phase26_subofficer_copilot.test.js']:
    ok(f'{path} exists', (root/path).exists())
ok('index links phase26 css', 'css/phase26-subofficer-copilot.css' in index)
ok('service worker caches phase26 css', './css/phase26-subofficer-copilot.css' in sw)
ok('service worker caches phase26 module', './js/systems/subOfficerCopilot.js' in sw)
ok('service worker caches avatar', './assets/avatars/subofficer_ww2.svg' in sw)
ok('smoke imports phase26 module', 'js/systems/subOfficerCopilot.js' in smoke)
ok('smoke loads phase26 css', 'css/phase26-subofficer-copilot.css' in smoke)
ok('gameplay imports phase26 module', 'subOfficerCopilot.js' in gameplay)
ok('gameplay renders copilot panel', 'phase26-subofficer-panel' in gameplay and 'subofficer-copilot' in gameplay)
ok('gameplay renders large acknowledgement', 'phase26-subofficer-ack' in gameplay and 'subofficer.ack' in gameplay)
ok('gameplay has typewriter function', 'typeSubOfficerLine' in gameplay and 'setInterval' in gameplay)
ok('gameplay updates subofficer each tick', 'updateSubOfficer(snapshot)' in gameplay)
ok('module exposes phase marker', 'PHASE26_SUBOFFICER' in module and 'subofficer-copilot' in module)
ok('module classifies key situations', all(token in module for token in ['aircraft-inbound','enemy-hunt','standing-by','fire-solution','damage-critical']))
ok('module supports interruptions', 'shouldSubOfficerInterrupt' in module and 'mustInterrupt' in module)
ok('css has mobile layout', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('css has avatar and OK button styling', 'phase26-subofficer-avatar' in css and 'phase26-subofficer-ack' in css)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['subofficer.rank','subofficer.msg.standby','subofficer.msg.enemyDetected','subofficer.msg.aircraft','subofficer.ack']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase26 subofficer copilot audit: {len(checks)} checks')
