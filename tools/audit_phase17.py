from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[1]
checks = []
def add(name, ok): checks.append((name, bool(ok)))
build = json.loads((root/'BUILD_INFO.json').read_text(encoding='utf-8'))
add('build semver phase17', build.get('semver') == '2.0.0-alpha.17')
add('build phase 17', build.get('phase') == '17')
add('css exists', (root/'css'/'phase17-sonar-room.css').exists())
gameplay = (root/'js'/'screens'/'gameplay.js').read_text(encoding='utf-8')
add('waterfall enlarged', 'phase17-waterfall' in gameplay and 'Array.from({ length: 26 }' in gameplay)
add('sonar status grid rendered', 'sonar-room-status-grid' in gameplay)
add('acoustic board rendered', 'sonar-room-acoustic-board' in gameplay)
index = (root/'index.html').read_text(encoding='utf-8')
sw = (root/'service-worker.js').read_text(encoding='utf-8')
add('index loads phase17 css', 'phase17-sonar-room.css' in index)
add('service worker caches phase17 css', 'phase17-sonar-room.css' in sw and "2.0.0-alpha.17" in sw)
for lang in ['pt-BR','en','es']:
    data=json.loads((root/'data'/'translations'/f'{lang}.json').read_text(encoding='utf-8'))
    add(f'translations {lang}', all(k in data for k in ['sonarRoom.acousticStatus','sonarRoom.signatureBoard','sonarRoom.riskHigh']))
failed=[name for name, ok in checks if not ok]
if failed:
    print('PHASE17 AUDIT FAIL')
    for item in failed: print('-', item)
    sys.exit(1)
print(f'PHASE17 AUDIT PASS: {len(checks)}/{len(checks)}')
