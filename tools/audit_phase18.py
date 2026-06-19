from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[1]
checks = []

def add(name, ok, detail=''):
    checks.append((name, ok, detail))

build = json.loads((root/'BUILD_INFO.json').read_text(encoding='utf-8'))
add('metadata phase 18', build.get('semver') == '2.0.0-alpha.18' and build.get('phase') == '18')
index = (root/'index.html').read_text(encoding='utf-8')
add('phase18 css loaded', 'css/phase18-periscope-optics.css' in index)
sw = (root/'service-worker.js').read_text(encoding='utf-8')
add('service worker phase18', "2.0.0-alpha.18" in sw and './css/phase18-periscope-optics.css' in sw)
gameplay = (root/'js/screens/gameplay.js').read_text(encoding='utf-8')
add('periscope helper exported', 'export function createPeriscopeOpticsSolution' in gameplay)
add('periscope optical readouts wired', 'periscope-optical-quality' in gameplay and 'periscope-depth-envelope' in gameplay)
css = (root/'css/phase18-periscope-optics.css').read_text(encoding='utf-8')
add('phase18 css exists', 'phase18-periscope-solution' in css and 'periscope-window::after' in css)
for lang in ['pt-BR','en','es']:
    d = json.loads((root/'data/translations'/f'{lang}.json').read_text(encoding='utf-8'))
    keys = ['periscope.opticalQuality','periscope.mastWake','periscope.depthEnvelope','periscope.estimatedRange','periscope.estimatedSpeed','periscope.errorWindow','periscope.depthEnvelopeValue']
    add(f'translation {lang}', all(k in d for k in keys))
pkg = json.loads((root/'package.json').read_text(encoding='utf-8'))
add('package version/script', pkg.get('version') == '2.0.0-alpha.18' and 'test:periscope-room' in pkg.get('scripts', {}))
failed = [item for item in checks if not item[1]]
if failed:
    print('PHASE18 AUDIT FAIL')
    for name, ok, detail in failed:
        print('FAIL', name, detail)
    sys.exit(1)
print(f'PHASE18 AUDIT PASS: {len(checks)}/{len(checks)}')
