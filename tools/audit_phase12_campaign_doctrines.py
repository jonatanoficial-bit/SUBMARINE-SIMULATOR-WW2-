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
    index = read('index.html')
    sw = read('service-worker.js')
    data_loader = read('js/dataLoader.js')
    app = read('js/app.js')
    campaign = read('js/screens/campaign.js')
    doctrines = j('data/campaign_doctrines.json')
    nations = j('data/nations.json')

    add('metadata points to phase 12 doctrine build', build.get('semver') == '2.0.0-alpha.27' and build.get('phase') == '12', build)
    add('package manifest and service worker updated', pkg.get('version') == '2.0.0-alpha.27' and manifest.get('version') == '2.0.0-alpha.27' and "CACHE_VERSION = '2.0.0-alpha.27'" in sw)
    add('index loads phase 12 doctrine css', 'css/phase12-campaign-doctrines.css' in index)
    add('service worker caches new doctrine assets', './data/campaign_doctrines.json' in sw and './js/systems/campaignDoctrine.js' in sw and './css/phase12-campaign-doctrines.css' in sw)
    add('loader validates campaign doctrines', 'campaignDoctrines' in data_loader and 'Campaign doctrines must cover every nation' in data_loader)
    add('doctrine module imported by app', './systems/campaignDoctrine.js' in app and 'applyDoctrineToPatrolCost' in app)
    add('patrol plan uses doctrine modifiers', 'doctrineImpact' in app and 'doctrineMods.readinessBonus' in app and 'doctrineMods.riskDelta' in app)
    add('mission completion uses doctrine rewards', 'doctrineMods.tonnageMultiplier' in app and 'doctrineMods.intelGain' in app and 'doctrineMods.pressureDelta' in app)
    add('campaign renderer has doctrine deck', 'renderDoctrineDeck' in campaign and 'phase12-doctrine-deck' in campaign)
    add('exactly one doctrine per nation', len(doctrines) == len(nations) and {d['nationId'] for d in doctrines} == {n['id'] for n in nations}, [d.get('nationId') for d in doctrines])

    for doctrine in doctrines:
        mods = doctrine.get('modifiers', {})
        add(
            f'{doctrine["nationId"]} doctrine has stages traits and modifiers',
            len(doctrine.get('stages', [])) == 3 and len(doctrine.get('traitKeys', [])) == 3 and all(k in mods for k in ['fuelMultiplier', 'torpedoMultiplier', 'tonnageMultiplier', 'readinessBonus', 'riskDelta']),
            doctrine.get('id'),
        )

    dicts = {lang: j(f'data/translations/{lang}.json') for lang in ['pt-BR', 'en', 'es']}
    add('translation parity across PT/EN/ES', len({frozenset(d) for d in dicts.values()}) == 1, {k: len(v) for k, v in dicts.items()})
    required = {'campaign.doctrineDeck.title', 'campaign.modifier.fuel', 'campaign.modifier.risk', 'phase12.tag'}
    for doctrine in doctrines:
        required.update([doctrine['titleKey'], doctrine['summaryKey'], doctrine['focusKey'], doctrine['bonusKey'], doctrine['riskKey'], *doctrine['traitKeys']])
        for stage in doctrine['stages']:
            required.update([stage['titleKey'], stage['descKey']])
    for lang, dictionary in dicts.items():
        add(f'doctrine translation keys exist {lang}', required.issubset(set(dictionary)), sorted(required - set(dictionary))[:12])

    ok, out = run(['node', '--test', 'tests/phase12_campaign_doctrines.test.js'])
    add('phase 12 doctrine unit tests pass', ok, out)
    ok, out = run(['node', '--test', 'tests/campaigns.test.js'])
    add('campaign regression tests pass', ok, out)

    js_fail = []
    for path in ROOT.glob('js/**/*.js'):
        ok, _ = run(['node', '--check', str(path.relative_to(ROOT))])
        if not ok:
            js_fail.append(str(path.relative_to(ROOT)))
    add('all JavaScript modules pass syntax check', not js_fail, js_fail[:20])

    passed = sum(c['status'] == 'PASS' for c in checks)
    failed = len(checks) - passed
    (ROOT / 'reports').mkdir(exist_ok=True)
    report = {'phase': '12', 'build': build, 'summary': {'passed': passed, 'failed': failed, 'total': len(checks)}, 'checks': checks}
    (ROOT / 'reports/phase12_campaign_doctrines_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    md = '# Phase 12 — National Campaign Doctrines Audit\n\n'
    md += f'PASS: {passed}/{len(checks)}\n\n'
    md += '\n'.join(f"- [{c['status']}] {c['name']} — {c['detail']}" for c in checks)
    md += '\n'
    (ROOT / 'reports/PHASE_12_CAMPAIGN_DOCTRINES_AUDIT.md').write_text(md, encoding='utf-8')
    print(f'PHASE 12 CAMPAIGN DOCTRINES AUDIT: {passed}/{len(checks)} PASS')
    for c in checks:
        print(f"[{c['status']}] {c['name']} {c['detail']}")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
