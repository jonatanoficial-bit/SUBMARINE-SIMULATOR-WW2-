from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
required = [
    root/'css'/'phase15-command-room.css',
    root/'js'/'screens'/'bridge.js',
    root/'js'/'screens'/'gameplay.js',
    root/'assets'/'backgrounds'/'submarine_control_room.png',
]
missing = [str(p) for p in required if not p.exists()]
if missing:
    print('PHASE15 AUDIT FAIL')
    print('Missing:', '\n'.join(missing))
    sys.exit(1)
print('PHASE15 AUDIT PASS: 4/4')
