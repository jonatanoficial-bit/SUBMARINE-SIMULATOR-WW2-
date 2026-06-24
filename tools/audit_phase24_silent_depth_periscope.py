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
gameplay = read('js/screens/gameplay.js')
css = read('css/phase24-silent-depth-periscope.css')
module = read('js/systems/silentDepthPeriscope.js')

ok('build version', build.get('version') == 'v2.0.0-alpha.40')
ok('phase id', build.get('phase') == '25')
ok('save schema', int(build.get('saveSchemaVersion')) == 19)
ok('package version', pkg.get('version') == '2.0.0-alpha.40')
ok('manifest version', manifest.get('version') == '2.0.0-alpha.40')
ok('package main test includes phase24', 'phase24_silent_depth_periscope.test.js' in pkg['scripts']['test'])
ok('package audit points to phase24', pkg['scripts']['audit'] == 'python3 tools/audit_phase24_silent_depth_periscope.py')
for path in ['js/systems/silentDepthPeriscope.js', 'css/phase24-silent-depth-periscope.css', 'tests/phase24_silent_depth_periscope.test.js']:
    ok(f'{path} exists', (root / path).exists())
ok('index links phase24 css', 'css/phase24-silent-depth-periscope.css' in index)
ok('service worker caches phase24 css', './css/phase24-silent-depth-periscope.css' in sw)
ok('service worker caches phase24 module', './js/systems/silentDepthPeriscope.js' in sw)
ok('gameplay imports phase24 module', 'silentDepthPeriscope.js' in gameplay)
ok('periscope modal uses phase24 class', 'phase24-silent-depth' in gameplay)
ok('gameplay uses natural drag normalizer', 'normalizePeriscopeDragDelta' in gameplay and 'engine.moveView(movement.dx, movement.dy)' in gameplay)
ok('left/right buttons corrected', "engine.moveView(-VIEW_STEP_X, 0)" in gameplay and "engine.moveView(VIEW_STEP_X, 0)" in gameplay)
ok('mobile clean ocean rule hides telemetry', re.search(r'periscope-data-ribbon,\s*\n\s*\.phase24-silent-depth \.phase18-periscope-solution[\s\S]*display:\s*none\s*!important', css) is not None)
ok('touch action locked', 'touch-action: none' in css)
ok('premium ocean viewport implemented', 'background-image:' in css and 'ocean_panorama_day.png' in css and 'phase24-ocean-swell' in css)
ok('module exposes phase marker', 'SILENT_DEPTH_PERISCOPE_PHASE' in module and 'natural-camera' in module)
ok('module clamps drag spikes', 'clamp((Number(deltaX)' in module and '42' in module and '24' in module)
for lang in ['pt-BR','en','es']:
    dictionary = load(f'data/translations/{lang}.json')
    for key in ['periscope.mobileAxisCue', 'phase24.title', 'phase24.summary']:
        ok(f'translation {lang} {key}', key in dictionary)
print(f'PASS phase24 silent depth periscope audit: {len(checks)} checks')
