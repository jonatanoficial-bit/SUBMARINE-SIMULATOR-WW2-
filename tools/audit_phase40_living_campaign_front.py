#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase40 living campaign front audit: {name}')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def load(path):
    return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/livingCampaignFront.js')
campaign = read('js/screens/campaign.js')
css = read('css/phase40-living-campaign.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')

ok('build version alpha55', build.get('version') == 'v2.0.0-alpha.55')
ok('build phase 40', build.get('phase') == '40')
ok('save schema 34', build.get('saveSchemaVersion') == 34)
ok('package version alpha55', pkg.get('version') == '2.0.0-alpha.55')
ok('manifest version alpha55', manifest.get('version') == '2.0.0-alpha.55')
ok('package audit script points to phase40', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase40_living_campaign_front.py')
ok('package includes phase40 test', 'phase40_living_campaign_front.test.js' in pkg.get('scripts', {}).get('test', ''))
ok('module exports metadata', 'PHASE40_LIVING_CAMPAIGN' in module and "system: 'living-campaign-war-front'" in module)
ok('module calculates campaign front', 'buildLivingCampaignFront' in module and 'enemyAdaptation' in module and 'theaterPressure' in module)
ok('module has pulse and directive states', all(token in module for token in ['pulseCrisis','directiveStealth','directiveExploit']))
ok('campaign imports living front', '../systems/livingCampaignFront.js' in campaign)
ok('campaign renders phase40 panel', 'phase40-living-campaign' in campaign and 'renderLivingCampaignFront' in campaign)
ok('css has mobile front panel', all(token in css for token in ['phase40-front-grid','phase40-front-card','phase40FrontPulse']))
ok('css has mobile breakpoints', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase40-living-campaign.css' in index)
ok('service worker cache bumped', '2.0.0-alpha.55' in sw)
ok('service worker caches css and module', 'phase40-living-campaign.css' in sw and 'livingCampaignFront.js' in sw)
ok('smoke has css and module', 'phase40-living-campaign.css' in smoke and 'livingCampaignFront.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['livingCampaign.kicker','livingCampaign.enemyAdaptation','livingCampaign.nextPulse','livingCampaign.directiveStealth']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase40 living campaign front audit: {len(checks)} checks')
