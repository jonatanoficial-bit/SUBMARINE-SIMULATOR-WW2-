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
system = read('js/systems/operationOutcomes.js')
outcomes = j('data/operation_outcomes.json')
chains = j('data/operation_chains.json')
nations = j('data/nations.json')
translations = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}

check('build version', build.get('version') == 'v2.0.0-alpha.34', build.get('version'))
check('semver synced', package.get('version') == build.get('semver') == manifest.get('version'), (package.get('version'), build.get('semver'), manifest.get('version')))
check('phase metadata', build.get('phase') == '19' and build.get('saveSchemaVersion') == 13, build)
check('cache version synced', "const CACHE_VERSION = '2.0.0-alpha.34';" in sw)
check('html css included', 'phase19-operation-outcomes.css' in index)
check('service worker assets included', all(item in sw for item in ['phase19-operation-outcomes.css','operationOutcomes.js','operation_outcomes.json']))
check('data loader loads operation outcomes', 'operationOutcomes' in loader and 'data/operation_outcomes.json' in loader)
check('app imports outcome system', 'systems/operationOutcomes.js' in app)
check('strategy renders outcome panel', 'phase19-operation-outcomes-panel' in strategy and 'choose-operation-outcome' in strategy)
check('campaign renders outcome deck', 'phase19-operation-outcomes' in campaign)
check('save persists outcomes', 'operationOutcomes' in save and 'chosenIds' in save and 'availableIds' in save)
check('system exports choice gate', 'canChooseOperationOutcome' in system and 'summarizeOperationOutcomes' in system)
check('package includes phase19 test', 'phase19_operation_outcomes.test.js' in package['scripts']['test'])
check('audit points to phase19', package['scripts']['audit'] == 'python3 tools/audit_phase19_operation_outcomes.py', package['scripts']['audit'])

nation_ids = {n['id'] for n in nations}
step_ids = {step['id'] for deck in chains for step in deck.get('steps', [])}
check('deck count equals nation count', len(outcomes) == len(nation_ids), len(outcomes))
check('deck coverage', {deck.get('nationId') for deck in outcomes} == nation_ids, {deck.get('nationId') for deck in outcomes})
required_keys = {
    'operationOutcomes.title','operationOutcomes.heading','operationOutcomes.progress','operationOutcomes.available','operationOutcomes.locked','operationOutcomes.chosen',
    'operationOutcomes.choose','operationOutcomes.outcomeActive','operationOutcomes.unavailable','operationOutcomes.alreadyChosen','operationOutcomes.choiceLocked',
    'operationOutcomes.lockedChain','operationOutcomes.lockedMissions','operationOutcomes.insufficientResources','operationOutcomes.noChoice','operationOutcomes.finalDoctrine',
    'operationOutcomes.historyTitle','operationOutcomes.historyDetail','operationOutcomes.reportTitle','operationOutcomes.reportDetail','toast.operationOutcomeChosen'
}
for deck in outcomes:
    check(f'{deck.get("id")} has 3 outcomes', len(deck.get('outcomes', [])) == 3)
    check(f'{deck.get("id")} requires 4 steps', len(deck.get('requires', {}).get('stepIds', [])) == 4)
    required_keys.update([deck.get('titleKey'), deck.get('summaryKey'), deck.get('frontKey')])
    for step_id in deck.get('requires', {}).get('stepIds', []):
        check(f'{deck.get("id")} step reference', step_id in step_ids, step_id)
    ids = set()
    for outcome in deck.get('outcomes', []):
        check(f'{outcome.get("id")} unique', outcome.get('id') not in ids, outcome.get('id'))
        ids.add(outcome.get('id'))
        required_keys.update([outcome.get('nameKey'), outcome.get('descKey'), outcome.get('doctrineKey')])
        for key in ['credits','commandPoints']:
            check(f'{outcome.get("id")} cost {key}', isinstance(outcome.get('cost', {}).get(key), (int, float)))
        for key in ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta']:
            check(f'{outcome.get("id")} effect {key}', isinstance(outcome.get('effect', {}).get(key), (int, float)))

for lang, dictionary in translations.items():
    for key in required_keys:
        check(f'{lang} translation {key}', key in dictionary)

if errors:
    print('FAIL phase19 operation outcomes audit')
    for error in errors:
        print('-', error)
    raise SystemExit(1)
print('PASS phase19 operation outcomes audit: {} checks'.format(40 + len(required_keys) * 3))
