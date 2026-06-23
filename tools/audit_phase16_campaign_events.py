#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def j(path):
    return json.loads(read(path))

def check(name, condition, detail=''):
    if not condition:
        errors.append(f'{name}: {detail}')

build = j('BUILD_INFO.json')
package = j('package.json')
manifest = j('manifest.json')
sw = read('service-worker.js')
index = read('index.html')
loader = read('js/dataLoader.js')
app = read('js/app.js')
strategy = read('js/screens/strategy.js')
campaign = read('js/screens/campaign.js')
save = read('js/save.js')
events = j('data/campaign_events.json')
orders = j('data/high_command_orders.json')
nations = j('data/nations.json')
translations = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}

check('build version', build.get('version') == 'v2.0.0-alpha.31', build.get('version'))
check('semver synced', package.get('version') == build.get('semver') == manifest.get('version'), (package.get('version'), build.get('semver'), manifest.get('version')))
check('phase metadata', build.get('phase') == '16' and build.get('saveSchemaVersion') == 10, build)
check('cache version synced', "const CACHE_VERSION = '2.0.0-alpha.31';" in sw)
check('html css included', 'phase16-campaign-events.css' in index)
check('service worker assets included', all(item in sw for item in ['phase16-campaign-events.css','campaignEvents.js','campaign_events.json']))
check('data loader loads campaign events', 'campaignEvents' in loader and 'data/campaign_events.json' in loader)
check('app imports campaign events system', 'systems/campaignEvents.js' in app)
check('strategy renders campaign event panel', 'phase16-campaign-events-panel' in strategy and 'acknowledge-campaign-event' in strategy)
check('campaign renders campaign event deck', 'phase16-campaign-events' in campaign)
check('save persists campaign events', 'campaignEvents' in save and 'acknowledgedIds' in save and 'currentIds' in save)
check('package includes phase16 test', 'phase16_campaign_events.test.js' in package['scripts']['test'])
check('audit points to phase16', package['scripts']['audit'] == 'python3 tools/audit_phase16_campaign_events.py', package['scripts']['audit'])

nation_ids = {n['id'] for n in nations}
order_ids = {order['id'] for deck in orders for order in deck.get('orders', [])}
check('deck count equals nation count', len(events) == len(nation_ids), len(events))
check('deck coverage', {deck.get('nationId') for deck in events} == nation_ids, {deck.get('nationId') for deck in events})
required_keys = {
    'campaignEvents.title','campaignEvents.heading','campaignEvents.volatility','campaignEvents.noActive',
    'campaignEvents.acknowledge','campaignEvents.acknowledged','campaignEvents.unavailable',
    'campaignEvents.alreadyAcknowledged','campaignEvents.inactive','toast.campaignEventAcknowledged',
    'campaignEvents.historyTitle','campaignEvents.historyDetail','campaignEvents.reportTitle','campaignEvents.reportDetail',
    'campaignEvents.severity.opportunity','campaignEvents.severity.warning','campaignEvents.severity.danger','campaignEvents.severity.crisis'
}
for deck in events:
    check(f'{deck.get("id")} has 5 events', len(deck.get('events', [])) == 5)
    required_keys.add(deck.get('titleKey'))
    required_keys.add(deck.get('summaryKey'))
    ids = set()
    for event in deck.get('events', []):
        check(f'{event.get("id")} unique', event.get('id') not in ids, event.get('id'))
        ids.add(event.get('id'))
        check(f'{event.get("id")} severity valid', event.get('severity') in {'opportunity','warning','danger','crisis'}, event.get('severity'))
        required_keys.update([event.get('nameKey'), event.get('descKey')])
        if event.get('trigger', {}).get('activeOrderId'):
            check(f'{event.get("id")} order reference', event['trigger']['activeOrderId'] in order_ids, event['trigger']['activeOrderId'])
        for key in ['intelBonus','decryptionBonus','pressureDelta','riskDelta','readinessBonus','tonnageMultiplier','moraleDelta','fatigueDelta']:
            check(f'{event.get("id")} effect {key}', isinstance(event.get('effect', {}).get(key), (int, float)))

for lang, dictionary in translations.items():
    for key in required_keys:
        check(f'{lang} translation {key}', key in dictionary)

if errors:
    print('FAIL phase16 campaign events audit')
    for error in errors:
        print('-', error)
    raise SystemExit(1)
print('PASS phase16 campaign events audit: {} checks'.format(24 + len(required_keys) * 3))
