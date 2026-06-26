#!/usr/bin/env python3
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks: list[tuple[str, bool, str]] = []

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def record(name: str, ok: bool, detail: str = '') -> None:
    checks.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{(' — ' + detail) if detail and not ok else ''}")

build = json.loads(read('BUILD_INFO.json'))
record('Build is phase 47 alpha.62', build.get('phase') == '47' and build.get('version') == 'v2.0.0-alpha.62', str(build))
for path in [
    'js/systems/captainCrewRealism.js',
    'css/phase47-captain-crew-realism.css',
    'tests/phase47_captain_crew_realism.test.js',
]:
    record(f'{path} exists', (ROOT / path).exists())

gameplay = read('js/screens/gameplay.js')
record('Gameplay has captain flow panel', 'phase47-captain-flow-panel' in gameplay)
record('Prepare attack does not fire automatically', "beginCaptainCrewOrder('prepare-attack'" in gameplay and "command === 'fire-confirm'" in gameplay)
record('Manual override function exists', "function setCaptainCommandMode(mode = 'captain')" in gameplay)
record('Crew avatar uses existing game avatars', 'sailor_01.png' in gameplay and 'officer_01.png' in gameplay)

subofficer = read('js/systems/subOfficerCopilot.js')
record('Subofficer consumes captain crew flow dialogue', 'buildCaptainCrewFlowDialogue' in subofficer)

sw = read('service-worker.js')
record('Service worker caches phase 47 files', 'captainCrewRealism.js' in sw and 'phase47-captain-crew-realism.css' in sw)

missing = []
for lang in ['pt-BR', 'en', 'es']:
    dictionary = json.loads(read(f'data/translations/{lang}.json'))
    for key in ['captainCrew.question.confirmFire', 'captainCrew.flow.awaitingFireOrder', 'captainCrew.action.fireConfirm']:
        if key not in dictionary:
            missing.append(f'{lang}:{key}')
record('Translations available in PT/EN/ES', not missing, ', '.join(missing))

failed = [name for name, ok, _ in checks if not ok]
if failed:
    print(f"Audit failed: {len(failed)} issue(s).", file=sys.stderr)
    sys.exit(1)
print('Phase 47 captain crew realism audit passed.')
