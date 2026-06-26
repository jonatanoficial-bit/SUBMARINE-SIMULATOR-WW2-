#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks = []
def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase45 flow subofficer hotfix audit: {name}')
def read(path): return (ROOT / path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
ui=read('js/components/ui.js'); lobby=read('js/screens/lobby.js'); gameplay=read('js/screens/gameplay.js')
sub=read('js/systems/subOfficerCopilot.js'); story=read('js/systems/storyCampaignDirector.js'); sw=read('service-worker.js')
css=read('css/phase41-flow-subofficer-periscope.css')
ok('version alpha60', build.get('version') == 'v2.0.0-alpha.60')
ok('phase 45', build.get('phase') == '45')
ok('schema 39', build.get('saveSchemaVersion') == 39)
ok('package alpha60', pkg.get('version') == '2.0.0-alpha.60')
ok('manifest alpha60', manifest.get('version') == '2.0.0-alpha.60')
ok('audit script active', pkg.get('scripts',{}).get('audit') == 'python3 tools/audit_phase45_flow_subofficer_hotfix.py')
ok('phase45 test active', 'phase45_flow_subofficer_hotfix.test.js' in pkg.get('scripts',{}).get('test',''))
ok('main lobby bridge card removed', 'data-nav="bridge"' not in lobby)
ok('bottom nav bridge removed', "id: 'bridge'" not in ui and 'data-nav="bridge"' not in ui)
ok('officer avatar in subofficer metadata', "avatar: 'assets/avatars/de/officer_01.png'" in sub)
ok('officer avatar in gameplay', 'assets/avatars/de/officer_01.png' in gameplay)
ok('officer avatar in story campaign', 'assets/avatars/de/officer_01.png' in story)
ok('service worker caches officer avatar', './assets/avatars/de/officer_01.png' in sw)
ok('ack is action first', 'dataset.subofficerAction' in gameplay and 'primaryAction?.labelKey' in gameplay)
ok('ack click executes action', 'runSubOfficerAction(command, station)' in gameplay)
ok('persistent threat acknowledgement fixed', 'acknowledgedSet.has(next.id)' in sub and 'if (next.mustInterrupt) return true;' in sub)
ok('aircraft primary action dive first', "actions: [action('emergency-dive'" in sub)
ok('hotfix CSS present', 'F45 hotfix' in css)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['subofficer.ack','subofficer.ackEmergency','nav.bridge']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase45 flow subofficer hotfix audit: {len(checks)} checks')
