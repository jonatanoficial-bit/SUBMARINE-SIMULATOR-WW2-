from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
checks = []

def check(name, ok, detail=''):
    checks.append((name, bool(ok), detail))

build = json.loads((ROOT / 'BUILD_INFO.json').read_text(encoding='utf-8'))
check('phase metadata', build.get('semver') == '2.0.0-alpha.21' and build.get('phase') == '21', build)
check('phase css loaded', 'phase21-damage-emergency.css' in (ROOT / 'index.html').read_text(encoding='utf-8'))
check('service worker caches css', 'phase21-damage-emergency.css' in (ROOT / 'service-worker.js').read_text(encoding='utf-8'))
damage = (ROOT / 'js/engine/damage/DamageControlSystem.js').read_text(encoding='utf-8')
for token in ['pressureIngress', 'smokeLoad', 'compartmentStability', 'setEmergencyPosture', 'emergencyVentilation', 'damageControlVersion: 2']:
    check(f'damage system token {token}', token in damage)
engine = (ROOT / 'js/engine/simulation/SimulationEngine.js').read_text(encoding='utf-8')
check('engine exposes posture command', 'setDamageEmergencyPosture' in engine and 'runEmergencyVentilation' in engine)
gameplay = (ROOT / 'js/screens/gameplay.js').read_text(encoding='utf-8')
for token in ['damage-emergency-grid', 'damage-posture-chip', 'damage-pressure-ingress', 'runEmergencyVentilation']:
    check(f'gameplay token {token}', token in gameplay)
for lang in ['pt-BR','en','es']:
    dictionary = json.loads((ROOT / 'data/translations' / f'{lang}.json').read_text(encoding='utf-8'))
    missing = [key for key in ['damage.pressureIngress','damage.smokeLoad','damage.compartmentStability','damage.posture.brace.short','damage.ventilate'] if key not in dictionary]
    check(f'translations {lang}', not missing, ', '.join(missing))
pkg = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
check('package version', pkg.get('version') == '2.0.0-alpha.21')
check('phase test registered', 'damage_emergency_phase21.test.js' in pkg.get('scripts', {}).get('test',''))
failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" :: {detail}" if detail and not ok else ''))
if failed:
    print(f"PHASE21 AUDIT FAIL: {len(checks)-len(failed)}/{len(checks)}")
    sys.exit(1)
print(f"PHASE21 AUDIT PASS: {len(checks)}/{len(checks)}")
