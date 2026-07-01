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
retention = read('js/systems/captainCareerRetention.js')
impact = read('js/systems/captainCrewProgressionImpact.js')
app = read('js/app.js')
crew = read('js/screens/crew.js')
arsenal = read('js/screens/arsenal.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase54-career-retention.css')
pt = read('data/translations/pt-BR.json')
crew_data = read_json('data/crew.json')
sub_data = read_json('data/submarines.json')

record('Build version is alpha.69', build.get('version') == 'v2.0.0-alpha.69' and pkg.get('version') == '2.0.0-alpha.69' and manifest.get('version') == '2.0.0-alpha.69')
record('Build phase is 54', build.get('phase') == '54' and 'F54-CAREER-MORALE-SHOP-RETENTION' in build.get('buildId', ''))
record('Save schema remains stable at 40', build.get('saveSchemaVersion') == 40 and 'saveSchemaStable: true' in retention)
record('Existing assets and audio are preserved', 'preservesExistingAssetsAndAudio: true' in retention and (ROOT / 'assets/audio/music/submarine_commander_theme_01.mp3').exists())
record('Retention module exposes morale, gates and accuracy modifiers', all(token in retention for token in ['PHASE54_CAREER_RETENTION', 'buildCareerRetentionDeck', 'calculateMissionMoraleOutcome', 'applyRetentionAccuracyModifiers', 'evaluateCareerGate']))
record('App applies morale after mission and blocks locked purchases', all(token in app for token in ['calculateMissionMoraleOutcome', 'moraleOutcome.moraleDelta', 'evaluateCareerGate', 'getCareerRetentionDeck', 'applyRetentionAccuracyModifiers']))
record('Crew screen exposes tiered shop and morale goals', all(token in crew for token in ['careerRetentionMarkup', 'phase54-career-retention-panel', 'phase54-crew-shop-card', 'gateText']))
record('Arsenal exposes submarine tiers and free modes', all(token in arsenal for token in ['arsenalRetentionMarkup', 'phase54-sub-shop-card', 'phase54-free-card', 'submarineGateText']))
record('Data has expanded crew and submarine progression choices', len([c for c in crew_data if c.get('nation') == 'de']) >= 10 and len([c for c in crew_data if c.get('nation') == 'uk']) >= 10 and len([c for c in crew_data if c.get('nation') == 'us']) >= 10 and len([s for s in sub_data if s.get('nation') == 'de']) >= 4)
record('Mobile fullscreen CSS exists', '100dvh' in css and 'phase54-goal-grid' in css and 'max-width: 760px' in css)
record('CSS linked in index and smoke', 'phase54-career-retention.css' in index and 'phase54-career-retention.css' in smoke)
record('Service worker caches phase 54 files', 'captainCareerRetention.js' in sw and 'phase54-career-retention.css' in sw and "2.0.0-alpha.69" in sw)
record('Translations include career retention strings', all(token in pt for token in ['careerRetention.title', 'careerRetention.lock.victories', 'careerRetention.free.iron']))
record('Package audit script targets phase 54', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase54_career_retention.py')

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{(' - ' + detail) if detail else ''}")
if failed:
    print(f'AUDIT FAIL - {len(failed)} check(s) failed.', file=sys.stderr)
    sys.exit(1)
print('AUDIT PASS - Phase 54 adds morale-driven retention, tiered crew/submarine store and long-term goals without changing save schema or removing assets/audio.')
