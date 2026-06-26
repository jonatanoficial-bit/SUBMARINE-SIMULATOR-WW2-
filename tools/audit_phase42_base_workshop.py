#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks=[]
def ok(name, cond):
    checks.append((name,bool(cond)))
    if not cond: raise SystemExit(f'FAIL phase42 base workshop audit: {name}')
def read(path): return (ROOT/path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
build=load('BUILD_INFO.json'); pkg=load('package.json'); manifest=load('manifest.json')
module=read('js/systems/baseWorkshopIntegration.js'); app=read('js/app.js'); arsenal=read('js/screens/arsenal.js')
css=read('css/phase42-base-workshop.css'); index=read('index.html'); sw=read('service-worker.js'); smoke=read('tests/smoke_test.py')
ok('build alpha57', build.get('version')=='v2.0.0-alpha.57')
ok('phase 42', build.get('phase')=='42')
ok('schema 36', build.get('saveSchemaVersion')==36)
ok('package alpha57', pkg.get('version')=='2.0.0-alpha.57')
ok('manifest alpha57', manifest.get('version')=='2.0.0-alpha.57')
ok('audit script active', pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase42_base_workshop.py')
ok('test registered', 'phase42_base_workshop_integration.test.js' in pkg.get('scripts',{}).get('test',''))
ok('module metadata', 'PHASE42_BASE_WORKSHOP_INTEGRATION' in module and "system: 'base-workshop-integration'" in module)
ok('module calculates bonus', all(token in module for token in ['calculateUpgradeBonus','applyUpgradeStats','buildWorkshopImpactReport','sonarRangePercent','hullPressureBonus']))
ok('app imports integration', 'baseWorkshopIntegration.js' in app and 'getWorkshopImpactReport' in app)
ok('arsenal impact panel', 'phase42-workshop-impact' in arsenal and 'directiveKey' in arsenal and 'restock-logistics' in arsenal)
ok('css mobile', 'phase42-impact-grid' in css and '@media (max-width: 920px)' in css)
ok('index css', 'phase42-base-workshop.css' in index)
ok('sw caches css/module', 'phase42-base-workshop.css' in sw and 'baseWorkshopIntegration.js' in sw)
ok('smoke has css/module', 'phase42-base-workshop.css' in smoke and 'baseWorkshopIntegration.js' in smoke)
for lang in ['pt-BR','en','es']:
    d=load(f'data/translations/{lang}.json')
    for key in ['workshop.title','workshop.directive.ready','workshop.card.sonar','workshop.effect.stealth']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase42 base workshop audit: {len(checks)} checks')
