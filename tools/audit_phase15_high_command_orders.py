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
orders = j('data/high_command_orders.json')
nations = j('data/nations.json')
translations = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}
app = read('js/app.js')
strategy = read('js/screens/strategy.js')
save = read('js/save.js')
loader = read('js/dataLoader.js')

check('build version', build.get('version') == 'v2.0.0-alpha.30', build.get('version'))
check('semver synced', package.get('version') == build.get('semver') == manifest.get('version'), (package.get('version'), build.get('semver'), manifest.get('version')))
check('phase metadata', build.get('phase') == '15' and build.get('saveSchemaVersion') == 9, build)
check('cache version synced', "const CACHE_VERSION = '2.0.0-alpha.30';" in sw)
check('html css included', 'phase15-high-command-orders.css' in index)
check('service worker assets included', all(item in sw for item in ['phase15-high-command-orders.css','highCommandOrders.js','high_command_orders.json']))
check('data loader loads high command', 'highCommandOrders' in loader and 'data/high_command_orders.json' in loader)
check('app imports high command system', 'systems/highCommandOrders.js' in app)
check('strategy renders high command panel', 'phase15-high-command-panel' in strategy and 'apply-high-command-order' in strategy)
check('save persists high command orders', 'highCommandOrders' in save and 'appliedIds' in save)

nation_ids = {n['id'] for n in nations}
check('deck count equals nation count', len(orders) == len(nation_ids), len(orders))
check('deck coverage', {deck.get('nationId') for deck in orders} == nation_ids, {deck.get('nationId') for deck in orders})
required_keys = {'highCommand.title','highCommand.heading','toast.highCommandApplied','highCommand.historyTitle','highCommand.reportTitle'}
for deck in orders:
    check(f'{deck.get("id")} has 4 orders', len(deck.get('orders', [])) == 4)
    required_keys.add(deck.get('titleKey'))
    required_keys.add(deck.get('summaryKey'))
    ids = set()
    for order in deck.get('orders', []):
        check(f'{order.get("id")} unique', order.get('id') not in ids, order.get('id'))
        ids.add(order.get('id'))
        required_keys.update([order.get('nameKey'), order.get('descKey')])
        for key in ['credits','commandPoints']:
            check(f'{order.get("id")} cost {key}', isinstance(order.get('cost', {}).get(key), (int, float)))
        for key in ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta']:
            check(f'{order.get("id")} effect {key}', isinstance(order.get('effect', {}).get(key), (int, float)))
        check(f'{order.get("id")} mission requirement', isinstance(order.get('requires', {}).get('completedMissions'), (int, float)))

for lang, dictionary in translations.items():
    for key in required_keys:
        check(f'{lang} translation {key}', key in dictionary)

if errors:
    print('FAIL phase15 high command audit')
    for error in errors:
        print('-', error)
    raise SystemExit(1)
print('PASS phase15 high command audit: {} checks'.format(18 + len(required_keys) * 3))
