#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase33 naval AI tactics audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
ai = read('js/engine/ai/NavalAISystem.js')
module = read('js/systems/navalAITacticalCoordinator.js')
gameplay = read('js/screens/gameplay.js')
css = read('css/phase33-naval-ai-tactics.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha48', build.get('version') == 'v2.0.0-alpha.48')
ok('build phase 33', build.get('phase') == '33')
ok('save schema 27', build.get('saveSchemaVersion') == 27)
ok('package version alpha48', pkg.get('version') == '2.0.0-alpha.48')
ok('manifest version alpha48', manifest.get('version') == '2.0.0-alpha.48')
ok('package audit script points to phase33', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase33_naval_ai_tactics.py')
ok('package includes phase33 test', 'phase33_naval_ai_tactics.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('naval ai has tactical version', 'PHASE33_TACTICAL_VERSION' in ai and 'tacticalVersion' in ai)
ok('naval ai updates tactical doctrine', 'updateTacticalDoctrine' in ai and 'torpedo-evasion' in ai and 'closing-pincer' in ai)
ok('naval ai improves escort pincer movement', 'pincerPressure' in ai and 'expanding-square' in ai and 'escortPincerRuns' in ai)
ok('module exports metadata', 'PHASE33_NAVAL_AI_TACTICS' in module and "system: 'naval-ai-tactical-coordinator'" in module)
ok('module builds tactical view', 'buildNavalAITacticalView' in module and 'escortRows' in module and 'cssVars' in module)
ok('gameplay imports coordinator', '../systems/navalAITacticalCoordinator.js' in gameplay)
ok('gameplay has phase33 ready class', 'phase33-naval-ai-ready' in gameplay)
ok('gameplay has phase33 panel ids', all(token in gameplay for token in ['phase33-ai-tactics-panel','phase33-ai-directive','phase33-escort-rows','updateNavalAI']))
ok('css has tactical panel and rows', all(token in css for token in ['phase33-ai-tactics-panel','phase33-ai-grid','phase33-escort-row','phase33ThreatPulse']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase33-naval-ai-tactics.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.48' in sw)
ok('service worker caches css and module', 'phase33-naval-ai-tactics.css' in sw and 'navalAITacticalCoordinator.js' in sw)
ok('smoke has css and module', 'phase33-naval-ai-tactics.css' in smoke and 'navalAITacticalCoordinator.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['navalAITactics.kicker','navalAITactics.screen.pincer','navalAITactics.reaction.torpedo-evasion','ai.tactics.directivePincer']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase33 naval AI tactics audit: {len(checks)} checks')
