#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
checks = []

def ok(name, condition, detail=''):
    if not condition:
        print(f'FAIL {name}: {detail}')
        sys.exit(1)
    checks.append(name)

def read_json(rel):
    with open(ROOT / rel, encoding='utf-8') as fh:
        return json.load(fh)

build = read_json('BUILD_INFO.json')
ok('build version', build.get('version') == 'v2.0.0-alpha.37')
ok('phase id', str(build.get('phase')) == '21')
ok('schema 15', int(build.get('saveSchemaVersion')) == 15)

nations = read_json('data/nations.json')
decks = read_json('data/command_advancement.json')
ok('advancement decks count', len(decks) == len(nations))
ok('advancement nations', {d['nationId'] for d in decks} == {n['id'] for n in nations})
steps = {st['id'] for d in read_json('data/operation_chains.json') for st in d.get('steps', [])}
outcomes = {out['id'] for d in read_json('data/operation_outcomes.json') for out in d.get('outcomes', [])}
for deck in decks:
    ok(f'{deck["id"]} five ranks', len(deck.get('ranks', [])) == 5)
    ok(f'{deck["id"]} rank order', [r.get('rankIndex') for r in deck['ranks']] == [1,2,3,4,5])
    for rank in deck['ranks']:
        req = rank.get('requires', {})
        if req.get('completedStepId'):
            ok(f'{rank["id"]} step ref', req['completedStepId'] in steps)
        if req.get('chosenOutcomeId'):
            ok(f'{rank["id"]} outcome ref', req['chosenOutcomeId'] in outcomes)
        for key in ['credits','xp','commandPoints','prestige']:
            ok(f'{rank["id"]} reward {key}', isinstance(rank.get('reward', {}).get(key), (int, float)))
        for key in ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta']:
            ok(f'{rank["id"]} effect {key}', isinstance(rank.get('effect', {}).get(key), (int, float)))

for lang in ['pt-BR','en','es']:
    dictionary = read_json(f'data/translations/{lang}.json')
    for deck in decks:
        for key in [deck['titleKey'], deck['summaryKey'], deck['frontKey']]:
            ok(f'{lang} {key}', key in dictionary)
        for rank in deck['ranks']:
            for key in [rank['rankKey'], rank['billetKey'], rank['descKey']]:
                ok(f'{lang} {key}', key in dictionary)

index = (ROOT / 'index.html').read_text(encoding='utf-8')
ok('css linked', 'phase21-command-advancement.css' in index)
app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
ok('app import', 'commandAdvancement.js' in app)
ok('dossier export', 'commandAdvancement: getCommandAdvancementSummaryForNation()' in app)
save = (ROOT / 'js/save.js').read_text(encoding='utf-8')
ok('save migration', 'commandAdvancement' in save and 'claimedIds' in save)
sw = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
ok('pwa data cache', 'command_advancement.json' in sw and 'commandAdvancement.js' in sw)
print(f'PASS phase21 command advancement audit: {len(checks)} checks')
