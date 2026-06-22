#!/usr/bin/env python3
from __future__ import annotations
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks = []


def add(name, ok, detail=''):
    checks.append({'name': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def j(rel):
    return json.loads(read(rel))


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + '\n' + r.stderr)[-20000:]


def main():
    build = j('BUILD_INFO.json')
    pkg = j('package.json')
    manifest = j('manifest.json')
    sw = read('service-worker.js')
    index = read('index.html')
    data_loader = read('js/dataLoader.js')
    app = read('js/app.js')
    campaign_screen = read('js/screens/campaign.js')
    save = read('js/save.js')
    objective_sets = j('data/campaign_objectives.json')
    nations = j('data/nations.json')
    mission_ids = {m['id'] for m in j('data/missions.json')}

    add('metadata points to phase 13 objective build', build.get('semver') == '2.0.0-alpha.28' and build.get('phase') == '13' and build.get('saveSchemaVersion') == 7, build)
    add('package manifest and service worker updated', pkg.get('version') == '2.0.0-alpha.28' and manifest.get('version') == '2.0.0-alpha.28' and "CACHE_VERSION = '2.0.0-alpha.28'" in sw)
    add('index loads campaign objective css', 'css/phase13-campaign-objectives.css' in index)
    add('service worker caches objective files', './data/campaign_objectives.json' in sw and './js/systems/campaignObjectives.js' in sw and './css/phase13-campaign-objectives.css' in sw)
    add('loader validates campaign objectives', 'campaignObjectives' in data_loader and 'Campaign objectives must cover every nation' in data_loader)
    add('app imports objective system', './systems/campaignObjectives.js' in app and 'applyCampaignObjectiveRewards' in app)
    add('save tracks objective reward claims', 'campaignObjectiveRewards' in save and 'saveSchemaVersion' in read('BUILD_INFO.json'))
    add('campaign screen renders objective deck', 'renderObjectiveDeck' in campaign_screen and 'phase13-campaign-objectives' in campaign_screen)
    add('exactly one objective set per nation', len(objective_sets) == len(nations) and {o['nationId'] for o in objective_sets} == {n['id'] for n in nations})

    for objective_set in objective_sets:
        nested = set()
        ok = len(objective_set.get('objectives', [])) == 4
        for objective in objective_set.get('objectives', []):
            ok = ok and objective['id'] not in nested
            nested.add(objective['id'])
            ok = ok and all(mid in mission_ids for mid in objective.get('missionIds', []))
            ok = ok and all(isinstance(objective.get('reward', {}).get(key), (int, float)) for key in ['credits', 'xp', 'commandPoints', 'reputation', 'prestige', 'intel', 'pressureRelief'])
        add(f'{objective_set["nationId"]} objectives have four rewarded acts', ok, objective_set.get('id'))

    dicts = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR', 'en', 'es']}
    add('translation parity across PT/EN/ES', len({frozenset(d) for d in dicts.values()}) == 1, {k: len(v) for k, v in dicts.items()})
    required = {'campaignObjectives.title', 'campaignObjectives.reward', 'campaignObjectives.rewardReport'}
    for objective_set in objective_sets:
        required.update([objective_set['titleKey'], objective_set['summaryKey']])
        for objective in objective_set['objectives']:
            required.update([objective['titleKey'], objective['descKey'], objective['effectKey']])
    for lang, dictionary in dicts.items():
        add(f'objective translation keys exist {lang}', required.issubset(set(dictionary)), sorted(required - set(dictionary))[:12])

    ok, out = run(['node', '--test', 'tests/phase13_campaign_objectives.test.js'])
    add('phase 13 objective unit tests pass', ok, out)
    ok, out = run(['node', '--test', 'tests/campaigns.test.js', 'tests/phase12_campaign_doctrines.test.js'])
    add('campaign and doctrine regression tests pass', ok, out)

    js_fail = []
    for path in ROOT.glob('js/**/*.js'):
        ok, _ = run(['node', '--check', str(path.relative_to(ROOT))])
        if not ok:
            js_fail.append(str(path.relative_to(ROOT)))
    add('all JavaScript modules pass syntax check', not js_fail, js_fail[:20])

    passed = sum(c['status'] == 'PASS' for c in checks)
    failed = len(checks) - passed
    (ROOT / 'reports').mkdir(exist_ok=True)
    report = {'phase': '13', 'build': build, 'summary': {'passed': passed, 'failed': failed, 'total': len(checks)}, 'checks': checks}
    (ROOT / 'reports/phase13_campaign_objectives_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    md = '# Phase 13 — Historic Campaign Objectives Audit\n\n'
    md += f'PASS: {passed}/{len(checks)}\n\n'
    md += '\n'.join(f"- [{c['status']}] {c['name']} — {c['detail']}" for c in checks)
    md += '\n'
    (ROOT / 'reports/PHASE_13_CAMPAIGN_OBJECTIVES_AUDIT.md').write_text(md, encoding='utf-8')
    print(f'PHASE 13 CAMPAIGN OBJECTIVES AUDIT: {passed}/{len(checks)} PASS')
    for c in checks:
        print(f"[{c['status']}] {c['name']} {c['detail']}")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
