#!/usr/bin/env python3
from __future__ import annotations
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name, ok, detail=''):
    checks.append({'name':name,'status':'PASS' if ok else 'FAIL','detail':str(detail)})
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def j(p): return json.loads(read(p))
def run(cmd):
    r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    return r.returncode==0,(r.stdout+'\n'+r.stderr)[-12000:]
def main():
    build=j('BUILD_INFO.json'); pkg=j('package.json'); sw=read('service-worker.js'); index=read('index.html'); app=read('js/app.js'); save=read('js/save.js'); loader=read('js/dataLoader.js')
    strategy=j('data/strategy.json'); logistics=j('data/logistics.json'); campaigns=j('data/campaigns.json'); missions=j('data/missions.json'); nations=j('data/nations.json')
    nation_ids={n['id'] for n in nations}
    check('phase 13 metadata', build.get('semver')=='2.0.0-alpha.13' and build.get('phase')=='13' and build.get('saveSchemaVersion')==5, build)
    check('index loads phase 13 css','css/phase13-strategic-command.css' in index)
    check('service worker caches phase 13 files', all(x in sw for x in ['./data/strategy.json','./css/phase13-strategic-command.css','./js/screens/strategy.js']))
    check('package version and scripts', pkg.get('version')=='2.0.0-alpha.13' and 'tests/strategic_command.test.js' in pkg.get('scripts',{}).get('test','') and pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase13.py')
    check('data loader fetches and validates strategy','strategy:' in loader and 'Strategy theaters must cover every nation' in loader and 'strategy.convoyLanes' in loader)
    check('strategy theaters cover every nation', {t.get('nationId') for t in strategy.get('theaters',[])}==nation_ids)
    check('strategy networks cover every nation', {n.get('nationId') for n in strategy.get('intelNetworks',[])}==nation_ids)
    for nation in nation_ids:
        check(f'{nation} has at least three convoy lanes', len([l for l in strategy.get('convoyLanes',[]) if l.get('nationId')==nation])>=3)
    check('strategic directives present', len(strategy.get('directives',[]))>=4, [d.get('id') for d in strategy.get('directives',[])])
    check('save migration adds strategy', all(token in save for token in ['sanitizeStrategy','defaultStrategyForNation','save.strategy']))
    check('app contains strategy screen and actions', all(token in app for token in ['renderStrategy','assessStrategicPosture','strategicPatrolModifier','select-convoy-lane','set-directive','invest-intelligence','run-decryption']))
    check('bottom navigation includes strategy', "id: 'strategy'" in read('js/components/ui.js'))
    check('career and logistics preserved', 'renderCareer' in app and 'data/logistics.json' in loader and len(logistics.get('planningProfiles',[]))>=4)
    check('campaigns preserved', len(campaigns)==3 and len(missions)==24 and {c['nationId'] for c in campaigns}==nation_ids)
    dicts={lang:j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}
    check('translation parity', len({frozenset(d.keys()) for d in dicts.values()})==1, {k:len(v) for k,v in dicts.items()})
    phase13_keys={'nav.strategy','strategy.title','strategy.convoyLanes','strategy.commandDirectives','strategy.directive.deception','strategy.network.us','toast.directiveIssued'}
    for lang,d in dicts.items(): check(f'phase 13 keys translated {lang}', not [k for k in phase13_keys if not d.get(k)])
    ok,out=run(['node','--test','tests/strategic_command.test.js']); check('strategic command unit tests pass',ok,out)
    ok,out=run(['node','--test','tests/career_logistics.test.js']); check('career logistics regression tests pass',ok,out)
    ok,out=run(['node','--test','tests/campaigns.test.js']); check('campaign regression tests pass',ok,out)
    js_fail=[]
    for path in ROOT.glob('js/**/*.js'):
        ok,_=run(['node','--check',str(path.relative_to(ROOT))])
        if not ok: js_fail.append(str(path.relative_to(ROOT)))
    check('all JS modules pass syntax check', not js_fail, js_fail[:10])
    passed=sum(1 for c in checks if c['status']=='PASS'); failed=len(checks)-passed
    report={'phase':'13','summary':{'passed':passed,'failed':failed,'total':len(checks)},'checks':checks}
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/phase13_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'reports/PHASE_13_AUDIT.md').write_text('# Phase 13 Audit\n\n'+f'PASS: {passed}/{len(checks)}\n\n'+'\n'.join(f"- [{c['status']}] {c['name']} — {c['detail']}" for c in checks)+'\n',encoding='utf-8')
    print(f'PHASE 13 AUDIT: {passed}/{len(checks)} PASS')
    for c in checks: print(f"[{c['status']}] {c['name']} {c['detail']}")
    return 0 if failed==0 else 1
if __name__=='__main__': raise SystemExit(main())
