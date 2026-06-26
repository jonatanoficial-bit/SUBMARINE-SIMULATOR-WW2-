#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
checks = []

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def read_json(path):
    return json.loads(read(path))

def record(name, ok, detail=''):
    checks.append((name, bool(ok), detail))

build = read_json('BUILD_INFO.json')
pkg = read_json('package.json')
manifest = read_json('manifest.json')
system = read('js/systems/captainCombatCycle.js')
gameplay = read('js/screens/gameplay.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase50-captain-combat-cycle.css')
pt = read('data/translations/pt-BR.json')

record('Build version is alpha.65', build.get('version') == 'v2.0.0-alpha.65' and pkg.get('version') == '2.0.0-alpha.65' and manifest.get('version') == '2.0.0-alpha.65')
record('Build phase is 50', build.get('phase') == '50' and 'CAPTAIN-COMBAT-CYCLE' in build.get('buildId', ''))
record('Save schema remains stable at 40', build.get('saveSchemaVersion') == 40 and 'saveSchemaStable: true' in system)
record('Combat cycle module exposes pure view builder', 'PHASE50_CAPTAIN_COMBAT_CYCLE' in system and 'evaluateCaptainCombatCycle' in system and 'buildCaptainCombatCycleView' in system)
record('Combat cycle covers required phases', all(token in system for token in ['contact', 'classification', 'solution', 'captainOrder', 'execution', 'consequence']))
record('Gameplay has phase 50 panel and update loop', 'phase50-combat-cycle' in gameplay and 'updateCaptainCombatCycle' in gameplay and 'combatCycleAction' in gameplay)
record('Captain/manual separation preserved', 'commandMode === \'manual\'' in system and 'captainCommandMode === \'manual\'' in gameplay)
record('CSS linked in index and smoke harness', 'phase50-captain-combat-cycle.css' in index and 'phase50-captain-combat-cycle.css' in smoke and 'phase50-combat-cycle' in css)
record('Service worker caches phase 50 files', 'captainCombatCycle.js' in sw and 'phase50-captain-combat-cycle.css' in sw)
record('Translations include combat cycle questions', 'combatCycle.question.fire' in pt and 'combatCycle.stage.consequence' in pt)
record('Package audit script targets phase 50', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase50_captain_combat_cycle.py')

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{(' - ' + detail) if detail else ''}")
if failed:
    print(f"AUDIT FAIL - {len(failed)} check(s) failed.", file=sys.stderr)
    sys.exit(1)
print('AUDIT PASS - Phase 50 captain combat cycle is wired and stable.')
