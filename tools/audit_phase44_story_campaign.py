#!/usr/bin/env python3
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition):
    checks.append((name, bool(condition)))
    if not condition:
        raise SystemExit(f'FAIL phase44 story campaign audit: {name}')

def read(path): return (ROOT / path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))

build = load('BUILD_INFO.json')
pkg = load('package.json')
manifest = load('manifest.json')
module = read('js/systems/storyCampaignDirector.js')
campaign = read('js/screens/campaign.js')
css = read('css/phase44-story-campaign.css')
index = read('index.html')
sw = read('service-worker.js')
smoke = read('tests/smoke_test.py')
ok('build version alpha59', build.get('version') == 'v2.0.0-alpha.59')
ok('build phase 44', build.get('phase') == '44')
ok('save schema 38', build.get('saveSchemaVersion') == 38)
ok('package version alpha59', pkg.get('version') == '2.0.0-alpha.59')
ok('manifest version alpha59', manifest.get('version') == '2.0.0-alpha.59')
ok('package audit script points to phase44', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase44_story_campaign.py')
ok('package includes phase44 test', 'phase44_story_campaign.test.js' in pkg.get('scripts', {}).get('test',''))
ok('module exports story metadata', 'PHASE44_STORY_CAMPAIGN_DIRECTOR' in module and 'story-campaign-director' in module)
ok('module builds story campaign flow', 'buildStoryCampaignFlow' in module and 'renderStoryCampaignPanel' in module and 'mission-rail' in module)
ok('campaign renders story panel', 'storyCampaignDirector' in campaign and 'renderStoryCampaignPanel' in campaign and 'phase44-story-shell' in campaign)
ok('css responsive mobile', '@media (max-width: 760px)' in css and '@media (max-width: 420px)' in css)
ok('index links css', 'css/phase44-story-campaign.css' in index)
ok('service worker caches assets', 'phase44-story-campaign.css' in sw and 'storyCampaignDirector.js' in sw)
ok('smoke includes assets', 'phase44-story-campaign.css' in smoke and 'storyCampaignDirector.js' in smoke)
for lang in ['pt-BR','en','es']:
    d = load(f'data/translations/{lang}.json')
    for key in ['storyCampaign.title','storyCampaign.subofficer.initial','storyCampaign.directive.firstPatrol','storyCampaign.beat.active']:
        ok(f'translation {lang} {key}', key in d)
print(f'PASS phase44 story campaign audit: {len(checks)} checks')
