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
ops_system = read('js/systems/specialOperations.js')
operations = j('data/special_operations.json')
events = j('data/campaign_events.json')
orders = j('data/high_command_orders.json')
nations = j('data/nations.json')
translations = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}

check('build version', build.get('version') == 'v2.0.0-alpha.32', build.get('version'))
check('semver synced', package.get('version') == build.get('semver') == manifest.get('version'), (package.get('version'), build.get('semver'), manifest.get('version')))
check('phase metadata', build.get('phase') == '17' and build.get('saveSchemaVersion') == 11, build)
check('cache version synced', "const CACHE_VERSION = '2.0.0-alpha.32';" in sw)
check('html css included', 'phase17-special-operations.css' in index)
check('service worker assets included', all(item in sw for item in ['phase17-special-operations.css','specialOperations.js','special_operations.json']))
check('data loader loads special operations', 'specialOperations' in loader and 'data/special_operations.json' in loader)
check('app imports special operations system', 'systems/specialOperations.js' in app)
check('strategy renders special operation panel', 'phase17-special-operations-panel' in strategy and 'launch-special-operation' in strategy)
check('campaign renders special operation deck', 'phase17-special-operations' in campaign)
check('save persists special operations', 'specialOperations' in save and 'launchedIds' in save and 'availableIds' in save)
check('system exports launch gate', 'canLaunchSpecialOperation' in ops_system and 'summarizeSpecialOperations' in ops_system)
check('package includes phase17 test', 'phase17_special_operations.test.js' in package['scripts']['test'])
check('audit points to phase17', package['scripts']['audit'] == 'python3 tools/audit_phase17_special_operations.py', package['scripts']['audit'])

nation_ids = {n['id'] for n in nations}
event_ids = {event['id'] for deck in events for event in deck.get('events', [])}
order_ids = {order['id'] for deck in orders for order in deck.get('orders', [])}
check('deck count equals nation count', len(operations) == len(nation_ids), len(operations))
check('deck coverage', {deck.get('nationId') for deck in operations} == nation_ids, {deck.get('nationId') for deck in operations})
required_keys = {
    'specialOps.title','specialOps.heading','specialOps.available','specialOps.launched','specialOps.locked','specialOps.launch',
    'specialOps.operationActive','specialOps.noAvailable','specialOps.unavailable','specialOps.alreadyLaunched','specialOps.lockedMissions',
    'specialOps.lockedEvent','specialOps.lockedOrder','specialOps.lockedPressure','specialOps.lockedIntel','specialOps.lockedDecryption',
    'specialOps.insufficientResources','specialOps.historyTitle','specialOps.historyDetail','specialOps.reportTitle','specialOps.reportDetail','toast.specialOperationLaunched'
}
for deck in operations:
    check(f'{deck.get("id")} has 4 operations', len(deck.get('operations', [])) == 4)
    required_keys.add(deck.get('titleKey'))
    required_keys.add(deck.get('summaryKey'))
    ids = set()
    for operation in deck.get('operations', []):
        check(f'{operation.get("id")} unique', operation.get('id') not in ids, operation.get('id'))
        ids.add(operation.get('id'))
        check(f'{operation.get("id")} severity valid', operation.get('severity') in {'opportunity','covert','support','danger'}, operation.get('severity'))
        required_keys.update([operation.get('nameKey'), operation.get('descKey'), operation.get('typeKey')])
        req = operation.get('requires', {})
        if req.get('activeEventId'):
            check(f'{operation.get("id")} event reference', req['activeEventId'] in event_ids, req['activeEventId'])
        if req.get('activeOrderId'):
            check(f'{operation.get("id")} order reference', req['activeOrderId'] in order_ids, req['activeOrderId'])
        for key in ['credits','commandPoints']:
            check(f'{operation.get("id")} cost {key}', isinstance(operation.get('cost', {}).get(key), (int, float)))
        for key in ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta']:
            check(f'{operation.get("id")} effect {key}', isinstance(operation.get('effect', {}).get(key), (int, float)))

for lang, dictionary in translations.items():
    for key in required_keys:
        check(f'{lang} translation {key}', key in dictionary)

if errors:
    print('FAIL phase17 special operations audit')
    for error in errors:
        print('-', error)
    raise SystemExit(1)
print('PASS phase17 special operations audit: {} checks'.format(32 + len(required_keys) * 3))
