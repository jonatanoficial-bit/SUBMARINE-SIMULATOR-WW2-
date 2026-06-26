#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks = []

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def record(label: str, passed: bool) -> None:
    checks.append((label, bool(passed)))

build = json.loads(read('BUILD_INFO.json'))
pkg = json.loads(read('package.json'))
manifest = json.loads(read('manifest.json'))
gameplay = read('js/screens/gameplay.js')
system = read('js/systems/captainOrderExecution.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase48-captain-order-execution.css')

record('Build version is alpha.64', build.get('version') == 'v2.0.0-alpha.64' and pkg.get('version') == '2.0.0-alpha.64' and manifest.get('version') == '2.0.0-alpha.64')
record('Phase metadata is 48', build.get('phase') == '49' and 'PHASE48_CAPTAIN_ORDER_EXECUTION' in system)
record('Save schema remains stable', build.get('saveSchemaVersion') == 40)
record('Gameplay has order execution board', 'phase48-order-board' in gameplay and 'updateCaptainExecutionBoard' in gameplay)
record('Captain orders register execution state', "registerCaptainExecution('prepare-attack'" in gameplay and "registerCaptainExecution('authorize-repair'" in gameplay and "registerCaptainExecution('fire-confirm'" in gameplay)
record('Manual mode is isolated', 'commandMode === \'manual\'' in system and 'captainExecution.effect.manual' in system)
record('CSS linked in index and smoke harness', 'phase48-captain-order-execution.css' in index and 'phase48-captain-order-execution.css' in smoke and 'phase48-order-board' in css)
record('Service worker caches phase 48 files', 'captainOrderExecution.js' in sw and 'phase48-captain-order-execution.css' in sw)
record('Translations have required keys', all('captainExecution.panel.kicker' in json.loads(read(f'data/translations/{lang}.json')) for lang in ['pt-BR','en','es']))

failed = [label for label, passed in checks if not passed]
for label, passed in checks:
    print(f"{'PASS' if passed else 'FAIL'} - {label}")
if failed:
    raise SystemExit(1)
print('AUDIT PASS - Phase 48 captain order execution board is wired and stable.')
