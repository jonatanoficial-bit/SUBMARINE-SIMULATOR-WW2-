#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase43 sandbox patrol audit: {name}')

def read(path): return (ROOT / path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/sandboxPatrolPlanner.js')
app = read('js/app.js')
campaign = read('js/screens/campaign.js')
css = read('css/phase43-sandbox-patrol.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
ok('build version alpha58', build.get('version') == 'v2.0.0-alpha.58')
ok('build phase 43', build.get('phase') == '43')
ok('save schema 37', build.get('saveSchemaVersion') == 37)
ok('package version alpha58', pkg.get('version') == '2.0.0-alpha.58')
ok('manifest version alpha58', manifest.get('version') == '2.0.0-alpha.58')
ok('package audit script points to phase43', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase43_sandbox_patrol.py')
ok('package includes phase43 test', 'phase43_sandbox_patrol.test.js' in pkg.get('scripts', {}).get('test',''))
ok('module exports sandbox metadata', 'PHASE43_SANDBOX_PATROL' in module and 'sandbox-patrol-planner' in module)
ok('module builds sandbox mission', 'buildSandboxMission' in module and 'SANDBOX_SCENARIOS' in module and 'missionMode' in module)
ok('campaign renders sandbox panel', 'renderSandboxPatrolPanel' in campaign and 'phase43-sandbox-panel' in module)
ok('app launches sandbox dynamically', 'launch-sandbox' in app and 'buildSandboxMission' in app and 'setMission(mission.id)' in app)
ok('css responsive mobile', '@media (max-width: 900px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase43-sandbox-patrol.css' in index)
ok('service worker caches assets', 'phase43-sandbox-patrol.css' in sw and 'sandboxPatrolPlanner.js' in sw)
ok('smoke includes assets', 'phase43-sandbox-patrol.css' in smoke and 'sandboxPatrolPlanner.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['sandbox.title','sandbox.launch','sandbox.objective.patrol','toast.sandboxReady']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase43 sandbox patrol audit: {len(checks)} checks')
