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
chains_system = read('js/systems/operationChains.js')
chains = j('data/operation_chains.json')
operations = j('data/special_operations.json')
events = j('data/campaign_events.json')
nations = j('data/nations.json')
translations = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}

check('build version', build.get('version') == 'v2.0.0-alpha.33', build.get('version'))
check('semver synced', package.get('version') == build.get('semver') == manifest.get('version'), (package.get('version'), build.get('semver'), manifest.get('version')))
check('phase metadata', build.get('phase') == '18' and build.get('saveSchemaVersion') == 12, build)
check('cache version synced', "const CACHE_VERSION = '2.0.0-alpha.33';" in sw)
check('html css included', 'phase18-operation-chains.css' in index)
check('service worker assets included', all(item in sw for item in ['phase18-operation-chains.css','operationChains.js','operation_chains.json']))
check('data loader loads operation chains', 'operationChains' in loader and 'data/operation_chains.json' in loader)
check('app imports operation chains system', 'systems/operationChains.js' in app)
check('strategy renders operation chain panel', 'phase18-operation-chains-panel' in strategy and 'execute-operation-chain-step' in strategy)
check('campaign renders operation chain deck', 'phase18-operation-chains' in campaign)
check('save persists operation chains', 'operationChains' in save and 'completedStepIds' in save and 'availableStepIds' in save)
check('system exports execution gate', 'canExecuteOperationChainStep' in chains_system and 'summarizeOperationChains' in chains_system)
check('package includes phase18 test', 'phase18_operation_chains.test.js' in package['scripts']['test'])
check('audit points to phase18', package['scripts']['audit'] == 'python3 tools/audit_phase18_operation_chains.py', package['scripts']['audit'])

nation_ids = {n['id'] for n in nations}
operation_ids = {operation['id'] for deck in operations for operation in deck.get('operations', [])}
event_ids = {event['id'] for deck in events for event in deck.get('events', [])}
check('deck count equals nation count', len(chains) == len(nation_ids), len(chains))
check('deck coverage', {deck.get('nationId') for deck in chains} == nation_ids, {deck.get('nationId') for deck in chains})
required_keys = {
    'operationChains.title','operationChains.heading','operationChains.progress','operationChains.available','operationChains.completed','operationChains.locked',
    'operationChains.execute','operationChains.stepActive','operationChains.nextStep','operationChains.unavailable','operationChains.alreadyCompleted',
    'operationChains.lockedMissions','operationChains.lockedPrevious','operationChains.lockedSpecialOperation','operationChains.lockedEvent','operationChains.lockedPressure',
    'operationChains.lockedIntel','operationChains.lockedDecryption','operationChains.insufficientResources','operationChains.historyTitle','operationChains.historyDetail',
    'operationChains.reportTitle','operationChains.reportDetail','toast.operationChainStepCompleted'
}
for deck in chains:
    check(f'{deck.get("id")} has 4 steps', len(deck.get('steps', [])) == 4)
    required_keys.update([deck.get('titleKey'), deck.get('summaryKey'), deck.get('frontKey')])
    ids = set()
    for step in deck.get('steps', []):
        check(f'{step.get("id")} unique', step.get('id') not in ids, step.get('id'))
        previous = set(ids)
        ids.add(step.get('id'))
        required_keys.update([step.get('nameKey'), step.get('descKey'), step.get('stageKey')])
        req = step.get('requires', {})
        if req.get('previousStepId'):
            check(f'{step.get("id")} previous step earlier', req['previousStepId'] in previous, req['previousStepId'])
        if req.get('launchedOperationId'):
            check(f'{step.get("id")} operation reference', req['launchedOperationId'] in operation_ids, req['launchedOperationId'])
        if req.get('activeEventId'):
            check(f'{step.get("id")} event reference', req['activeEventId'] in event_ids, req['activeEventId'])
        for key in ['credits','commandPoints']:
            check(f'{step.get("id")} cost {key}', isinstance(step.get('cost', {}).get(key), (int, float)))
        for key in ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta']:
            check(f'{step.get("id")} effect {key}', isinstance(step.get('effect', {}).get(key), (int, float)))

for lang, dictionary in translations.items():
    for key in required_keys:
        check(f'{lang} translation {key}', key in dictionary)

if errors:
    print('FAIL phase18 operation chains audit')
    for error in errors:
        print('-', error)
    raise SystemExit(1)
print('PASS phase18 operation chains audit: {} checks'.format(32 + len(required_keys) * 3))
