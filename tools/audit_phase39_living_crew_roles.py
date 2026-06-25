#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase39 living crew roles audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/livingCrewRoles.js')
gameplay = read('js/screens/gameplay.js')
css = read('css/phase39-crew-roles.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha54', build.get('version') == 'v2.0.0-alpha.54')
ok('build phase 39', build.get('phase') == '39')
ok('save schema 33', build.get('saveSchemaVersion') == 33)
ok('package version alpha54', pkg.get('version') == '2.0.0-alpha.54')
ok('manifest version alpha54', manifest.get('version') == '2.0.0-alpha.54')
ok('package audit script points to phase39', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase39_living_crew_roles.py')
ok('package includes phase39 test', 'phase39_living_crew_roles.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE39_LIVING_CREW_ROLES' in module and "system: 'living-crew-roles'" in module)
ok('module builds crew view', 'buildLivingCrewRolesView' in module and 'dominantRole' in module and 'overallReadiness' in module)
ok('module supports six roles', all(token in module for token in ['commander', 'executive', 'sonar', 'engineer', 'weapons', 'navigator']))
ok('module escalates interruptions', 'shouldCrewRoleInterrupt' in module and 'commandState' in module)
ok('gameplay imports crew roles', '../systems/livingCrewRoles.js' in gameplay)
ok('gameplay has phase39 ready class', 'phase39-crew-roles-ready' in gameplay)
ok('gameplay has panel ids', all(token in gameplay for token in ['phase39-crew-roles-panel','phase39-crew-grid','phase39-command-state','updateLivingCrewRoles']))
ok('css has crew panel and cards', all(token in css for token in ['phase39-crew-roles-panel','phase39-crew-card','phase39-crew-readouts','phase39CrewPulse']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase39-crew-roles.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.54' in sw)
ok('service worker caches css and module', 'phase39-crew-roles.css' in sw and 'livingCrewRoles.js' in sw)
ok('smoke has css and module', 'phase39-crew-roles.css' in smoke and 'livingCrewRoles.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['crewRoles.kicker','crewRoles.role.commander','crewRoles.role.engineer','crewRoles.directive.commanderPatrol','crewRoles.focus.route']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase39 living crew roles audit: {len(checks)} checks')
