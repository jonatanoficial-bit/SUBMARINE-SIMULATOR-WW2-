#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase30 waypoint navigation audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/waypointNavigation.js')
nav = read('js/engine/navigation/NavigationSystem.js')
sim = read('js/engine/simulation/SimulationEngine.js')
gameplay = read('js/screens/gameplay.js')
css = read('css/phase30-waypoint-navigation.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha45', build.get('version') == 'v2.0.0-alpha.45')
ok('build phase 30', build.get('phase') == '30')
ok('save schema 24', build.get('saveSchemaVersion') == 24)
ok('package version alpha45', pkg.get('version') == '2.0.0-alpha.45')
ok('manifest version alpha45', manifest.get('version') == '2.0.0-alpha.45')
ok('package audit script points to phase30', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase30_waypoint_navigation.py')
ok('package includes phase30 test', 'phase30_waypoint_navigation.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE30_WAYPOINT_NAVIGATION' in module and "system: 'waypoint-navigation-planner'" in module)
ok('module builds route legs', 'buildRouteLegs' in module and 'bearingLabel' in module and 'etaLabel' in module)
ok('module builds patrol route', 'buildPatrolRouteFromSector' in module and 'patrol-entry' in module)
ok('navigation system plans patrol sector route', 'planPatrolSectorRoute' in nav and 'replaceRoute' in nav and 'navigationVersion: 2' in nav)
ok('simulation engine exposes route planning', 'planPatrolSectorRoute()' in sim and 'this.navigation.planPatrolSectorRoute()' in sim)
ok('gameplay imports waypoint navigation', "../systems/waypointNavigation.js" in gameplay)
ok('gameplay has phase30 ready class', 'phase30-waypoint-navigation-ready' in gameplay)
ok('gameplay has planner panel ids', all(token in gameplay for token in ['phase30-route-planner','nav-route-leg-list','nav-plan-patrol','nav-route-leg-labels']))
ok('gameplay updates waypoint navigation', 'updateWaypointNavigation' in gameplay and 'buildWaypointNavigationView' in gameplay)
ok('css has route planner style', all(token in css for token in ['phase30-route-planner','phase30-route-leg-list','phase30-route-leg-label']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase30-waypoint-navigation.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.45' in sw)
ok('service worker caches css and module', 'phase30-waypoint-navigation.css' in sw and 'waypointNavigation.js' in sw)
ok('smoke has css and module', 'phase30-waypoint-navigation.css' in smoke and 'waypointNavigation.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['waypointNav.kicker','waypointNav.orderTransit','waypointNav.planPatrol','waypointNav.autonomySafe','waypointNav.wpPatrolEntry']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase30 waypoint navigation audit: {len(checks)} checks')
