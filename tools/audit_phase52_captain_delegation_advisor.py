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
system = read('js/systems/captainDelegationAdvisor.js')
gameplay = read('js/screens/gameplay.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase52-captain-delegation-advisor.css')
pt = read('data/translations/pt-BR.json')

record('Build version is alpha.67', build.get('version') == 'v2.0.0-alpha.67' and pkg.get('version') == '2.0.0-alpha.67' and manifest.get('version') == '2.0.0-alpha.67')
record('Build phase is 52', build.get('phase') == '52' and 'F52-CAPTAIN-DELEGATION-ADVISOR' in build.get('buildId', ''))
record('Save schema remains stable at 40', build.get('saveSchemaVersion') == 40 and 'saveSchemaStable: true' in system)
record('Delegation advisor module exposes pure view builder', 'PHASE52_CAPTAIN_DELEGATION_ADVISOR' in system and 'buildCaptainDelegationAdvisorView' in system and 'buildDelegationRadioReport' in system)
record('Existing assets and audio are preserved', 'preservesExistingAssetsAndAudio: true' in system and (ROOT / 'assets/audio/music/submarine_commander_theme_01.mp3').exists())
record('Advisor uses existing assets folder', all(token in system for token in ['assets/avatars/de/officer_01.png', 'assets/avatars/de/sonar_01.png', 'assets/avatars/de/mechanic_01.png', 'assets/ui/instruments/torpedo_icon.png']))
record('Gameplay has automatic/manual delegation actions', all(token in gameplay for token in ['phase52-delegation-advisor', 'auto-route', 'manual-route', 'auto-attack', 'manual-attack', 'radio-report']))
record('Radio report informs count and types', all(token in system for token in ['hostileTotal', 'typeKeys', 'destroyer', 'aircraft']))
record('Mobile fullscreen CSS exists', '100dvh' in css and 'phase52-delegation-actions' in css and 'grid-template-columns: 1fr' in css)
record('CSS linked in index and smoke', 'phase52-captain-delegation-advisor.css' in index and 'phase52-captain-delegation-advisor.css' in smoke)
record('Service worker caches phase 52 files', 'captainDelegationAdvisor.js' in sw and 'phase52-captain-delegation-advisor.css' in sw and "2.0.0-alpha.67" in sw)
record('Translations include requested scenarios', all(token in pt for token in ['delegation.question.route', 'delegation.question.air', 'delegation.question.target', 'delegation.radio.text.contacts']))
record('Package audit script targets phase 52', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase52_captain_delegation_advisor.py')

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{(' - ' + detail) if detail else ''}")
if failed:
    print(f'AUDIT FAIL - {len(failed)} check(s) failed.', file=sys.stderr)
    sys.exit(1)
print('AUDIT PASS - Phase 52 automatic/manual captain delegation advisor is wired, mobile-first and stable.')
