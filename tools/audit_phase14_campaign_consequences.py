#!/usr/bin/env python3
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
errors = []
def read(path):
    try:
        return json.loads((ROOT / path).read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'{path}: {exc}')
        return None
build = read('BUILD_INFO.json') or {}
if build.get('version') != 'v2.0.0-alpha.29': errors.append('BUILD_INFO version mismatch')
if build.get('phase') != '14': errors.append('BUILD_INFO phase mismatch')
consequences = read('data/campaign_consequences.json') or []
nations = read('data/nations.json') or []
if {c.get('nationId') for c in consequences} != {n.get('id') for n in nations}: errors.append('Campaign consequences do not cover every nation')
for item in consequences:
    if len(item.get('tracks', [])) != 4: errors.append(f"{item.get('id')} must have 4 tracks")
    if len(item.get('milestones', [])) != 4: errors.append(f"{item.get('id')} must have 4 milestones")
for path in ['index.html','service-worker.js']:
    text = (ROOT / path).read_text(encoding='utf-8')
    for marker in ['phase14-campaign-consequences.css','campaign_consequences.json','campaignConsequences.js']:
        if marker.endswith('.js') and path == 'index.html':
            continue
        if marker not in text and not (path == 'index.html' and marker == 'campaign_consequences.json'):
            errors.append(f'{path} missing {marker}')
for lang in ['pt-BR','en','es']:
    dictionary = read(f'data/translations/{lang}.json') or {}
    for key in ['campaignConsequences.title','campaignConsequences.strategyPanel','campaignConsequences.de.title','campaignConsequences.uk.title','campaignConsequences.us.title']:
        if key not in dictionary: errors.append(f'{lang} missing {key}')
if errors:
    print('FAIL phase14 campaign consequences audit')
    for error in errors: print('-', error)
    sys.exit(1)
print('PASS phase14 campaign consequences audit')
print(f'validated consequences={len(consequences)} languages=3 build={build.get("version")}')
