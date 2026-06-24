import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
checks = []

def read(path):
    return (root / path).read_text(encoding='utf-8')

def add(name, condition, detail=''):
    checks.append((name, bool(condition), detail))

build = json.loads(read('BUILD_INFO.json'))
pkg = json.loads(read('package.json'))
manifest = json.loads(read('manifest.json'))
index = read('index.html')
sw = read('service-worker.js')
crew_js = read('js/screens/crew.js')
module = read('js/systems/crewReadiness.js')
css = read('css/phase23-crew-readiness.css')

add('phase metadata', build.get('semver') == '2.0.0-alpha.23' and build.get('phase') == '25')
add('package version', pkg.get('version') == '2.0.0-alpha.23')
add('audit script active', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase23.py')
add('manifest version', manifest.get('version') == '2.0.0-alpha.23')
add('html title version', 'v2.0.0-alpha.23' in index)
add('phase23 css loaded', 'css/phase23-crew-readiness.css' in index and './css/phase23-crew-readiness.css' in sw)
add('crew readiness module cached', './js/systems/crewReadiness.js' in sw)
add('crew readiness module exports assessment', 'export function assessCrewReadiness' in module)
add('station coverage export exists', 'createCrewStationCoverage' in module and 'CREW_STATIONS' in module)
add('crew screen imports readiness', "../systems/crewReadiness.js" in crew_js)
add('crew screen renders watch rotation', 'crew-watch-grid' in crew_js and 'crew-readiness-panel' in crew_js)
add('mobile crew CSS present', '@media (max-width: 520px)' in css)
for lang in ['pt-BR','en','es']:
    data = json.loads(read(f'data/translations/{lang}.json'))
    missing = [key for key in ['crew.readinessTitle','crew.stationCoverage','crew.watchRotation','crew.rec.coverage','crew.station.command'] if not data.get(key)]
    add(f'translations {lang}', not missing, ','.join(missing))

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(('PASS' if ok else 'FAIL') + ' - ' + name + (f': {detail}' if detail else ''))
if failed:
    raise SystemExit(f'PHASE23 AUDIT FAIL: {len(failed)}/{len(checks)} failed')
print(f'PHASE23 AUDIT PASS: {len(checks)}/{len(checks)}')
