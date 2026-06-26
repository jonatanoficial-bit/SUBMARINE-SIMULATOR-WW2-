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
system = read('js/systems/captainCommandRoom.js')
gameplay = read('js/screens/gameplay.js')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
css = read('css/phase51-captain-command-room.css')
pt = read('data/translations/pt-BR.json')

record('Build version is alpha.66', build.get('version') == 'v2.0.0-alpha.66' and pkg.get('version') == '2.0.0-alpha.66' and manifest.get('version') == '2.0.0-alpha.66')
record('Build phase is 51', build.get('phase') == '51' and 'F51-CAPTAIN-COMMAND-ROOM' in build.get('buildId', ''))
record('Save schema remains stable at 40', build.get('saveSchemaVersion') == 40 and 'saveSchemaStable: true' in system)
record('Command room module exposes pure view builder', 'PHASE51_CAPTAIN_COMMAND_ROOM' in system and 'buildCaptainCommandRoomView' in system)
record('Existing assets and audio are explicitly preserved', 'preservesExistingAssetsAndAudio: true' in system and (ROOT / 'assets/audio/music/submarine_commander_theme_01.mp3').exists())
record('Command room uses real assets folder avatars and instruments', all(token in system for token in ['assets/avatars/de/officer_01.png', 'assets/avatars/de/sonar_01.png', 'assets/avatars/de/mechanic_01.png', 'assets/ui/instruments/torpedo_icon.png']))
record('Gameplay has phase 51 panel, update loop and action binding', all(token in gameplay for token in ['phase51-command-room-definitive', 'updateCaptainCommandRoom', 'commandRoomPrimary', 'commandRoomStations']))
record('Captain/manual separation preserved', 'commandMode === \'manual\'' in system and "captainCommandMode === 'manual'" in gameplay)
record('CSS linked in index and smoke harness', 'phase51-captain-command-room.css' in index and 'phase51-captain-command-room.css' in smoke and 'phase51-command-room-definitive' in css)
record('Mobile fullscreen focus exists', '100dvh' in css and 'overflow-x: auto' in css and 'display: flex' in css)
record('Service worker caches phase 51 files', 'captainCommandRoom.js' in sw and 'phase51-captain-command-room.css' in sw)
record('Translations include command room decisions', 'commandRoom.headline.fire' in pt and 'commandRoom.decision.damage' in pt and 'commandRoom.action.returnCaptain' in pt)
record('Package audit script targets phase 51', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase51_captain_command_room.py')

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{(' - ' + detail) if detail else ''}")
if failed:
    print(f"AUDIT FAIL - {len(failed)} check(s) failed.", file=sys.stderr)
    sys.exit(1)
print('AUDIT PASS - Phase 51 definitive captain command room is wired, mobile-first and stable.')
