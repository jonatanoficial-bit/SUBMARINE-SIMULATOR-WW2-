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
ok('build version', build.get('version') == 'v2.0.0-alpha.35')
ok('phase id', str(build.get('phase')) == '20')
ok('schema 14', int(build.get('saveSchemaVersion')) == 14)

nations = read_json('data/nations.json')
honors = read_json('data/operational_honors.json')
ok('honor decks count', len(honors) == len(nations))
ok('honor nations', {d['nationId'] for d in honors} == {n['id'] for n in nations})
ops = {op['id'] for d in read_json('data/special_operations.json') for op in d.get('operations', [])}
steps = {st['id'] for d in read_json('data/operation_chains.json') for st in d.get('steps', [])}
outcomes = {out['id'] for d in read_json('data/operation_outcomes.json') for out in d.get('outcomes', [])}
for deck in honors:
    ok(f'{deck["id"]} five honors', len(deck.get('honors', [])) == 5)
    tiers = [h.get('tier') for h in deck['honors']]
    ok(f'{deck["id"]} tier order', tiers == [1,2,3,4,5])
    for honor in deck['honors']:
        req = honor.get('requires', {})
        reward = honor.get('reward', {})
        if req.get('launchedOperationId'):
            ok(f'{honor["id"]} operation ref', req['launchedOperationId'] in ops)
        if req.get('completedStepId'):
            ok(f'{honor["id"]} step ref', req['completedStepId'] in steps)
        if req.get('chosenOutcomeId'):
            ok(f'{honor["id"]} outcome ref', req['chosenOutcomeId'] in outcomes)
        for key in ['credits','xp','commandPoints','reputation','prestige','intelBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta']:
            ok(f'{honor["id"]} reward {key}', isinstance(reward.get(key), (int, float)))

for lang in ['pt-BR','en','es']:
    dictionary = read_json(f'data/translations/{lang}.json')
    for deck in honors:
        for key in [deck['titleKey'], deck['summaryKey'], deck['frontKey']]:
            ok(f'{lang} {key}', key in dictionary)
        for honor in deck['honors']:
            for key in [honor['nameKey'], honor['descKey'], honor['ribbonKey']]:
                ok(f'{lang} {key}', key in dictionary)

index = (ROOT / 'index.html').read_text(encoding='utf-8')
ok('css linked', 'phase20-operational-honors.css' in index)
app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
ok('app import', 'operationalHonors.js' in app)
ok('dossier export', 'operationalHonors: getOperationalHonorSummaryForNation()' in app)
save = (ROOT / 'js/save.js').read_text(encoding='utf-8')
ok('save migration', 'operationalHonors' in save and 'awardedIds' in save)
print(f'PASS phase20 operational honors audit: {len(checks)} checks')
