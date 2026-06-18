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
    logistics=j('data/logistics.json'); campaigns=j('data/campaigns.json'); missions=j('data/missions.json'); nations=j('data/nations.json')
    check('phase 12 metadata', build.get('semver')=='2.0.0-alpha.12' and build.get('phase')=='12' and build.get('saveSchemaVersion')==4, build)
    check('QA gate status allowed', build.get('qaStatus') in {'PENDING','PASS'}, build.get('qaStatus'))
    check('index loads phase 12 css','css/phase12-career-logistics.css' in index)
    check('service worker caches phase 12 files', all(x in sw for x in ['./data/logistics.json','./css/phase12-career-logistics.css','./js/screens/career.js']))
    check('data loader fetches and validates logistics','logistics:' in loader and 'Logistics bases must cover every nation' in loader and 'planningProfiles' in loader)
    check('package version and scripts', pkg.get('version')=='2.0.0-alpha.12' and 'tests/career_logistics.test.js' in pkg.get('scripts',{}).get('test','') and pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase12.py')
    nation_ids={n['id'] for n in nations}
    check('logistics bases cover every nation', {b.get('nationId') for b in logistics.get('bases',[])}==nation_ids, [b.get('nationId') for b in logistics.get('bases',[])])
    check('four sortie planning profiles', len(logistics.get('planningProfiles',[]))>=4, [p.get('id') for p in logistics.get('planningProfiles',[])])
    for nation in nation_ids:
        check(f'{nation} rank ladder present', len(logistics.get('ranks',{}).get(nation,[]))>=4, logistics.get('ranks',{}).get(nation,[]))
    check('medal rules present', len(logistics.get('medals',[]))>=4, [m.get('id') for m in logistics.get('medals',[])])
    check('save migration adds career and logistics', all(token in save for token in ['sanitizeCareer','sanitizeLogistics','save.career','save.logistics','defaultLogisticsForNation']))
    check('app contains logistics launch gate', all(token in app for token in ['ensurePatrolReadyForLaunch','applyPatrolPlan','calculatePatrolPlan','getReadiness','renderCareer']))
    check('mission completion updates career record', all(token in app for token in ['serviceRecord','estimatedTonnage','applyRankAndMedals','state.save.logistics.activePlan = null']))
    check('bottom navigation includes career', "id: 'career'" in read('js/components/ui.js'))
    check('briefing exposes logistics readiness', 'briefing-logistics-card' in read('js/screens/briefing.js'))
    # Preserve F11 campaign requirements
    check('three campaigns preserved', len(campaigns)==3 and {c['nationId'] for c in campaigns}==nation_ids)
    check('twenty four missions preserved', len(missions)==24 and all(len(c.get('missionIds',[]))==8 for c in campaigns))
    langs=['pt-BR','en','es']; dicts={lang:j(f'data/translations/{lang}.json') for lang in langs}
    check('translation parity', len({frozenset(d.keys()) for d in dicts.values()})==1, {k:len(v) for k,v in dicts.items()})
    phase12_keys={'nav.career','career.title','logistics.sortiePlanning','logistics.plan.aggressive','toast.patrolPlanned','medal.firstPatrol','rank.de.3','rank.uk.3','rank.us.3'}
    for lang,d in dicts.items():
        missing=sorted(k for k in phase12_keys if not d.get(k))
        check(f'phase 12 keys translated {lang}', not missing, missing)
    ok,out=run(['node','--test','tests/career_logistics.test.js']); check('career logistics unit tests pass',ok,out)
    ok,out=run(['node','--test','tests/campaigns.test.js']); check('campaign regression tests pass',ok,out)
    js_fail=[]
    for path in ROOT.glob('js/**/*.js'):
        ok,_=run(['node','--check',str(path.relative_to(ROOT))])
        if not ok: js_fail.append(str(path.relative_to(ROOT)))
    check('all JS modules pass syntax check', not js_fail, js_fail[:10])
    passed=sum(1 for c in checks if c['status']=='PASS'); failed=len(checks)-passed
    report={'phase':'12','summary':{'passed':passed,'failed':failed,'total':len(checks)},'checks':checks}
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/phase12_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'reports/PHASE_12_AUDIT.md').write_text('# Phase 12 Audit\n\n'+f'PASS: {passed}/{len(checks)}\n\n'+'\n'.join(f"- [{c['status']}] {c['name']} — {c['detail']}" for c in checks)+'\n',encoding='utf-8')
    print(f'PHASE 12 AUDIT: {passed}/{len(checks)} PASS')
    for c in checks: print(f"[{c['status']}] {c['name']} {c['detail']}")
    return 0 if failed==0 else 1
if __name__=='__main__': raise SystemExit(main())
