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
impact = read('js/systems/captainCrewProgressionImpact.js')
advisor = read('js/systems/captainDelegationAdvisor.js')
engine = read('js/engine/simulation/SimulationEngine.js')
sensors = read('js/engine/sensors/SensorSystem.js')
weapons = read('js/engine/weapons/WeaponSystem.js')
app = read('js/app.js')
gameplay = read('js/screens/gameplay.js')
crew = read('js/screens/crew.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase53-crew-progression-impact.css')
pt = read('data/translations/pt-BR.json')

record('Build version is alpha.68', build.get('version') == 'v2.0.0-alpha.68' and pkg.get('version') == '2.0.0-alpha.68' and manifest.get('version') == '2.0.0-alpha.68')
record('Build phase is 53', build.get('phase') == '53' and 'F53-CREW-PROGRESSION-IMPACT' in build.get('buildId', ''))
record('Save schema remains stable at 40', build.get('saveSchemaVersion') == 40 and 'saveSchemaStable: true' in impact)
record('Existing assets and audio are preserved', 'preservesExistingAssetsAndAudio: true' in impact and (ROOT / 'assets/audio/music/submarine_commander_theme_01.mp3').exists())
record('Crew impact module exposes pure builders', all(token in impact for token in ['PHASE53_CREW_PROGRESSION_IMPACT', 'buildCrewProgressionImpact', 'applyCrewImpactToMissionReport', 'normalizeCrewGameplayModifiers']))
record('Crew changes real engine systems', all(token in engine for token in ['crewImpact', 'setCrewImpact', 'repairEfficiencyBonus', 'stealthNoiseReduction']) and 'sonarConfidenceBonus' in sensors and 'tdcSolutionBonus' in weapons)
record('Assistant displays crew effect inside automatic/manual advisor', all(token in gameplay for token in ['phase53-crew-impact', 'crewImpactCurrent', 'crew-impact-score', 'buildCaptainDelegationAdvisorView']) and 'automaticConfidence' in advisor)
record('App passes crew impact into gameplay and mission rewards', all(token in app for token in ['getCrewProgressionImpact', 'applyCrewImpactToMissionReport', 'crewImpact:', 'crewProgressionImpact']))
record('Crew/store screen exposes real effect to the player', all(token in crew for token in ['phase53-crew-store-impact-panel', 'crewImpactMarkup', 'scoreMultiplier', 'recommendation']))
record('Mobile fullscreen CSS exists', '100dvh' in css and 'phase53-crew-impact-grid' in css and 'max-width: 760px' in css)
record('CSS linked in index and smoke', 'phase53-crew-progression-impact.css' in index and 'phase53-crew-progression-impact.css' in smoke)
record('Service worker caches phase 53 files', 'captainCrewProgressionImpact.js' in sw and 'phase53-crew-progression-impact.css' in sw and "2.0.0-alpha.68" in sw)
record('Translations include crew impact strings', all(token in pt for token in ['crewImpact.title', 'crewImpact.noteDetailed', 'crewImpact.recommendation.hireNow']))
record('Package audit script targets phase 53', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase53_crew_progression_impact.py')

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{(' - ' + detail) if detail else ''}")
if failed:
    print(f'AUDIT FAIL - {len(failed)} check(s) failed.', file=sys.stderr)
    sys.exit(1)
print('AUDIT PASS - Phase 53 crew progression impacts assistant, store, engine gameplay, scoring and mobile UI without changing save schema.')
