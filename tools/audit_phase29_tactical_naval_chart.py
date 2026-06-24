#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase29 tactical naval chart audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/tacticalNavalChart.js')
gameplay = read('js/screens/gameplay.js')
css = read('css/phase29-tactical-naval-chart.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha44', build.get('version') == 'v2.0.0-alpha.44')
ok('build phase 29', build.get('phase') == '29')
ok('save schema 23', build.get('saveSchemaVersion') == 23)
ok('package version alpha44', pkg.get('version') == '2.0.0-alpha.44')
ok('manifest version alpha44', manifest.get('version') == '2.0.0-alpha.44')
ok('package audit script points to phase29', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase29_tactical_naval_chart.py')
ok('package includes phase29 test', 'phase29_tactical_naval_chart.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE29_TACTICAL_NAVAL_CHART' in module and "system: 'tactical-naval-chart'" in module)
ok('module projects chart points', 'projectChartPoint' in module and 'CHART_WIDTH' in module and 'CHART_HEIGHT' in module)
ok('module builds convoy lanes', 'buildConvoyLanes' in module and 'lane-hx' in module and 'lane-sc' in module and 'lane-on' in module)
ok('module builds danger zones', 'buildDangerZones' in module and 'air-sweep' in module and 'escort-hunt' in module)
ok('module formats coordinates', 'formatChartCoordinate' in module and 'formatChartCoordinate(position)' in module and 'positive' in module and 'negative' in module)
ok('gameplay imports tactical chart', "../systems/tacticalNavalChart.js" in gameplay)
ok('gameplay has chart ready class', 'phase29-tactical-chart-ready' in gameplay)
ok('gameplay has chart svg groups', all(token in gameplay for token in ['nav-chart-lanes','nav-chart-danger-zones','nav-chart-labels']))
ok('gameplay updates chart', 'updateTacticalNavalChart' in gameplay and 'buildTacticalNavalChartView' in gameplay)
ok('css has nautical chart style', all(token in css for token in ['phase29-chart-strip','phase29-chart-lane','phase29-chart-danger','phase29-chart-coast']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase29-tactical-naval-chart.css' in index)
ok('service worker cache bumped', "2.0.0-alpha.44" in sw)
ok('service worker caches css and module', 'phase29-tactical-naval-chart.css' in sw and 'tacticalNavalChart.js' in sw)
ok('smoke has css and module', 'phase29-tactical-naval-chart.css' in smoke and 'tacticalNavalChart.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['navalChart.kicker','navalChart.title','navalChart.scale','navalChart.bounds']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase29 tactical naval chart audit: {len(checks)} checks')
