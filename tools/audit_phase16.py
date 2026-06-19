from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[1]
required = [
    root/'css'/'phase16-buoyancy-depth.css',
    root/'tests'/'phase16_buoyancy.test.js',
    root/'js'/'engine'/'physics'/'SubmarinePhysicsSystem.js',
    root/'js'/'screens'/'bridge.js',
    root/'js'/'screens'/'gameplay.js',
]
missing = [str(p.relative_to(root)) for p in required if not p.exists()]
if missing:
    print('PHASE16 AUDIT FAIL')
    print('\n'.join(missing))
    sys.exit(1)
build = json.loads((root/'BUILD_INFO.json').read_text(encoding='utf-8'))
checks = [
    build.get('semver') == '2.0.0-alpha.16',
    build.get('phase') == '16',
    'phase16-buoyancy-depth.css' in (root/'index.html').read_text(encoding='utf-8'),
    'reserveBuoyancy' in (root/'js'/'engine'/'physics'/'SubmarinePhysicsSystem.js').read_text(encoding='utf-8'),
    'depthZone' in (root/'js'/'screens'/'bridge.js').read_text(encoding='utf-8'),
]
if not all(checks):
    print('PHASE16 AUDIT FAIL')
    print(checks)
    sys.exit(1)
print('PHASE16 AUDIT PASS: 5/5')
