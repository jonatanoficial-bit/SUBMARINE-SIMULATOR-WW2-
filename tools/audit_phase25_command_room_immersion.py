#!/usr/bin/env python3
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition, detail=''):
    if not condition:
        raise SystemExit(f'FAIL: {name} {detail}')
    checks.append(name)

def read(path):
    return (root / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
index = read('index.html')
sw = read('service-worker.js')
bridge = read('js/screens/bridge.js')
gameplay = read('js/screens/gameplay.js')
module = read('js/systems/commandRoomImmersion.js')
css = read('css/phase25-silent-depth-command-room.css')
smoke = read('tests/smoke_test.py')

ok('build version', build.get('version') == 'v2.0.0-alpha.40')
ok('phase id', build.get('phase') == '25')
ok('save schema', int(build.get('saveSchemaVersion')) == 19)
ok('package version', pkg.get('version') == '2.0.0-alpha.40')
ok('manifest version', manifest.get('version') == '2.0.0-alpha.40')
ok('package main test includes phase25 command room', 'phase25_command_room_immersion.test.js' in pkg['scripts']['test'])
ok('package audit points to phase25 command room', pkg['scripts']['audit'] == 'python3 tools/audit_phase25_command_room_immersion.py')
for path in ['js/systems/commandRoomImmersion.js', 'css/phase25-silent-depth-command-room.css', 'tests/phase25_command_room_immersion.test.js']:
    ok(f'{path} exists', (root / path).exists())
ok('index links phase25 command room css', 'css/phase25-silent-depth-command-room.css' in index)
ok('service worker caches phase25 css', './css/phase25-silent-depth-command-room.css' in sw)
ok('service worker caches phase25 module', './js/systems/commandRoomImmersion.js' in sw)
ok('smoke imports phase25 module', 'js/systems/commandRoomImmersion.js' in smoke)
ok('smoke loads phase25 css', 'css/phase25-silent-depth-command-room.css' in smoke)
ok('bridge imports command room module', 'commandRoomImmersion.js' in bridge)
ok('bridge uses cabin root class', 'phase25-command-room' in bridge)
ok('bridge renders cabin frame', 'phase25-cabin-frame' in bridge)
ok('bridge renders crew watch silhouettes', 'phase25-crew-watch' in bridge and 'phase25-crew-silhouette' in bridge)
ok('bridge renders ambience console', 'phase25-ambience-console' in bridge)
ok('gameplay shell gets immersive class', 'phase25-command-room-shell' in gameplay)
ok('module has phase marker', 'PHASE25_COMMAND_ROOM' in module and 'immersive-submarine-command-room' in module)
ok('module computes emergency alert', 'alertLevel' in module and 'emergency' in module and 'action-stations' in module)
ok('module builds five stations', all(token in module for token in ['helm', 'sonar', 'periscope', 'torpedo', 'engineering']))
ok('css has metal cabin frame', 'phase25-cabin-rib' in css and 'phase25-cabin-pipe' in css and 'phase25-cabin-valve' in css)
ok('css has mobile protections', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('css has red light variables', '--phase25-red-opacity' in css and '--phase25-condensation-opacity' in css)
ok('css has station severity led', 'phase25-station-led' in css and 'data-severity="critical"' in css)
for lang in ['pt-BR','en','es']:
    dictionary = load(f'data/translations/{lang}.json')
    for key in ['phase25.title', 'phase25.summary', 'phase25.prompt.emergency', 'phase25.station.engine.strain']:
        ok(f'translation {lang} {key}', key in dictionary)
print(f'PASS phase25 command room immersion audit: {len(checks)} checks')
