from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[1]
checks = []
def check(name, ok):
    checks.append((name, bool(ok)))

build = json.loads((root/'BUILD_INFO.json').read_text(encoding='utf-8'))
package = json.loads((root/'package.json').read_text(encoding='utf-8'))
index = (root/'index.html').read_text(encoding='utf-8')
sw = (root/'service-worker.js').read_text(encoding='utf-8')
gameplay = (root/'js/screens/gameplay.js').read_text(encoding='utf-8')
check('metadata phase 19', build.get('semver') == '2.0.0-alpha.19' and build.get('phase') == '19')
check('package phase 19', package.get('version') == '2.0.0-alpha.19')
check('phase 19 css exists', (root/'css/phase19-tdc-fire-control.css').exists())
check('index loads phase 19 css', 'phase19-tdc-fire-control.css' in index)
check('service worker caches phase 19 css', 'phase19-tdc-fire-control.css' in sw and "2.0.0-alpha.19" in sw)
check('gameplay has tdc solution panel', 'phase19-tdc-solution' in gameplay and 'createTdcFireControlSolution' in gameplay)
check('tdc room test registered', 'phase19_tdc_room.test.js' in package['scripts']['test'])
for lang in ['pt-BR','en','es']:
    data = json.loads((root/'data'/'translations'/f'{lang}.json').read_text(encoding='utf-8'))
    check(f'translations {lang}', all(key in data for key in ['tdc.attackTriangle','tdc.fireDiscipline','tdc.discipline.fire']))
failed = [name for name, ok in checks if not ok]
if failed:
    print('PHASE19 AUDIT FAIL')
    for name in failed: print('-', name)
    sys.exit(1)
print(f'PHASE19 AUDIT PASS: {len(checks)}/{len(checks)}')
