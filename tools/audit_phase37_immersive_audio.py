#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks=[]
def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase37 immersive audio audit: {name}')
def read(path): return (ROOT/path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
module=read('js/systems/immersiveAudioDirector.js'); gameplay=read('js/screens/gameplay.js'); audio=read('js/audio.js')
css=read('css/phase37-immersive-audio.css'); index=read('index.html'); sw=read('service-worker.js'); smoke=read('tests/smoke_test.py')
ok('build version alpha52', build.get('version')=='v2.0.0-alpha.52')
ok('build phase 37', build.get('phase')=='37')
ok('save schema 31', build.get('saveSchemaVersion')==31)
ok('package version alpha52', pkg.get('version')=='2.0.0-alpha.52')
ok('manifest version alpha52', manifest.get('version')=='2.0.0-alpha.52')
ok('audit script active', pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase37_immersive_audio.py')
ok('package includes phase37 test', 'phase37_immersive_audio.test.js' in pkg.get('scripts',{}).get('test',''))
ok('module metadata', 'PHASE37_IMMERSIVE_AUDIO' in module and "system: 'immersive-audio-director'" in module)
ok('module builds view', 'buildImmersiveAudioDirectorView' in module and 'shouldAudioCueTrigger' in module)
ok('module classifies states', all(token in module for token in ['emergency', 'combat', 'deep', 'machinery', 'silent']))
ok('audio has procedural cues', all(token in audio for token in ["case 'klaxon'", "case 'hullCreak'", "case 'sonarClose'", "case 'crewDive'", "case 'radioStatic'"]))
ok('ambience uses pressure and detection', 'pressurePercent' in audio and 'detectionScore' in audio)
ok('gameplay imports director', '../systems/immersiveAudioDirector.js' in gameplay)
ok('gameplay ready class', 'phase37-immersive-audio-ready' in gameplay)
ok('gameplay panel ids', all(token in gameplay for token in ['phase37-audio-director','phase37-audio-state','phase37-crew-line','updateImmersiveAudioDirector']))
ok('css panel and pulse', 'phase37-audio-director' in css and 'phase37AudioPulse' in css)
ok('css mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase37-immersive-audio.css' in index)
ok('sw cache bumped', '2.0.0-alpha.52' in sw)
ok('sw caches files', 'phase37-immersive-audio.css' in sw and 'immersiveAudioDirector.js' in sw)
ok('smoke includes files', 'phase37-immersive-audio.css' in smoke and 'immersiveAudioDirector.js' in smoke)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['immersiveAudio.kicker','immersiveAudio.state.combat','immersiveAudio.crew.aswHunt','immersiveAudio.mixEmergency']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase37 immersive audio audit: {len(checks)} checks')
