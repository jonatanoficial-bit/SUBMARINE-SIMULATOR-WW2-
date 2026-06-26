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
system = read('js/systems/captainCommandChain.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase49-captain-command-chain.css')

record('Build version is alpha.64', build.get('version') == 'v2.0.0-alpha.64' and pkg.get('version') == '2.0.0-alpha.64' and manifest.get('version') == '2.0.0-alpha.64')
record('Phase metadata is 49', build.get('phase') == '49' and 'PHASE49_CAPTAIN_COMMAND_CHAIN' in system)
record('Save schema remains stable', build.get('saveSchemaVersion') == 40)
record('Gameplay has reactive command chain panel', 'phase49-command-chain' in gameplay and 'updateCaptainCommandChain' in gameplay)
record('Chain analyzes captain realism conflicts', all(token in system for token in ['damageCritical', 'tooDeep', 'needPeriscope', 'readyToFire', 'escortThreat']))
record('Manual mode remains isolated', "commandMode === 'manual'" in system and 'captainChain.response.manual' in system)
record('CSS linked in index and smoke harness', 'phase49-captain-command-chain.css' in index and 'phase49-captain-command-chain.css' in smoke and 'phase49-command-chain' in css)
record('Service worker caches phase 49 files', 'captainCommandChain.js' in sw and 'phase49-captain-command-chain.css' in sw)
record('Translations have required keys', all('captainChain.panel.kicker' in json.loads(read(f'data/translations/{lang}.json')) for lang in ['pt-BR','en','es']))

failed = [label for label, passed in checks if not passed]
for label, passed in checks:
    print(f"{'PASS' if passed else 'FAIL'} - {label}")
if failed:
    raise SystemExit(1)
print('AUDIT PASS - Phase 49 reactive captain command chain is wired and stable.')
