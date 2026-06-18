#!/usr/bin/env python3
from __future__ import annotations
import json, re, subprocess, sys
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
    build=j('BUILD_INFO.json'); pkg=j('package.json'); sw=read('service-worker.js'); index=read('index.html'); app=read('js/app.js'); loader=read('js/dataLoader.js')
    missions=j('data/missions.json'); campaigns=j('data/campaigns.json'); nations=j('data/nations.json')
    check('phase 11 metadata', build.get('semver')=='2.0.0-alpha.11' and build.get('phase')=='11' and build.get('version')=='v2.0.0-alpha.11', build)
    check('QA gate status allowed', build.get('qaStatus') in {'PENDING','PASS'}, build.get('qaStatus'))
    check('index loads phase 11 css','css/phase11-campaigns.css' in index)
    check('service worker caches campaign data and css','./data/campaigns.json' in sw and './css/phase11-campaigns.css' in sw)
    check('data loader fetches and validates campaigns','campaigns:' in loader and 'assertArray(\'campaigns\'' in loader and 'Campaign ${campaign.id}' in loader)
    check('package version and scripts', pkg.get('version')=='2.0.0-alpha.11' and 'tests/campaigns.test.js' in pkg.get('scripts',{}).get('test','') and pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase11.py')
    nation_ids={n['id'] for n in nations}; mission_ids={m['id'] for m in missions}; campaign_ids={c['id'] for c in campaigns}
    check('three campaigns for three nations', len(campaigns)==3 and {c['nationId'] for c in campaigns}==nation_ids, [c.get('nationId') for c in campaigns])
    for c in campaigns:
        check(f'campaign {c["id"]} has 8 missions', len(c.get('missionIds',[]))==8, c.get('missionIds'))
        check(f'campaign {c["id"]} missions exist', all(mid in mission_ids for mid in c.get('missionIds',[])))
    for nation in nation_ids:
        ordered=[m for m in missions if m.get('nationId')==nation]
        camp=next(c for c in campaigns if c['nationId']==nation)
        check(f'{nation} mission order matches campaign', [m['id'] for m in ordered]==camp['missionIds'], [m['id'] for m in ordered])
        check(f'{nation} first mission only available at baseline', ordered[0]['status']=='available' and all(m['status']=='locked' for m in ordered[1:]))
    required_fields=['nationId','campaignId','campaignOrder','baseKey','strategicGoalKey','enemyKey','chronologyKey','doctrineKey','navigation']
    check('all missions include campaign metadata', all(all(field in m for field in required_fields) for m in missions))
    check('mission ids unique', len(mission_ids)==len(missions))
    check('campaign ids unique', len(campaign_ids)==len(campaigns))
    check('mission campaign references valid', all(m.get('campaignId') in campaign_ids and m.get('nationId') in nation_ids for m in missions))
    check('app filters missions by current nation', all(token in app for token in ['missionsForNation','getCampaignForNation','getCampaignProgress','ensureSelectedMissionForNation']))
    check('completion unlocks within campaign', 'campaignMissions = missionsForNation(mission.nationId)' in app)
    check('campaign renderer receives filtered missions', 'renderCampaign(translate, missionsForNation()' in app)
    check('briefing renderer receives campaign intel', 'renderBriefing(translate, mission, state.operationAutosave, getCampaignForNation' in app)
    langs=['pt-BR','en','es']; dicts={lang:j(f'data/translations/{lang}.json') for lang in langs}
    check('translation parity', len({frozenset(d.keys()) for d in dicts.values()})==1, {k:len(v) for k,v in dicts.items()})
    keys=set()
    for c in campaigns:
        for f in ['titleKey','summaryKey','baseKey','chronologyKey','doctrineKey','strategicGoalKey','enemyKey']: keys.add(c[f])
    for m in missions:
        for f in ['titleKey','summaryKey','theatreKey','operationKey','historicalNoteKey','baseKey','strategicGoalKey','enemyKey','chronologyKey','doctrineKey']: keys.add(m[f])
        keys.add(m['navigation']['patrolSector']['labelKey'])
        keys.update(m.get('objectiveKeys',[]))
    for lang,d in dicts.items():
        missing=sorted(k for k in keys if not d.get(k))
        check(f'all campaign keys translated {lang}', not missing, missing[:20])
    ok,out=run(['node','--test','tests/campaigns.test.js']); check('campaign unit tests pass',ok,out)
    # Syntax check JS modules quickly
    js_fail=[]
    for path in ROOT.glob('js/**/*.js'):
        ok,_=run(['node','--check',str(path.relative_to(ROOT))])
        if not ok: js_fail.append(str(path.relative_to(ROOT)))
    check('all JS modules pass syntax check', not js_fail, js_fail[:10])
    passed=sum(1 for c in checks if c['status']=='PASS'); failed=len(checks)-passed
    report={'phase':'11','summary':{'passed':passed,'failed':failed,'total':len(checks)},'checks':checks}
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/phase11_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'reports/PHASE_11_AUDIT.md').write_text('# Phase 11 Audit\n\n'+f'PASS: {passed}/{len(checks)}\n\n'+'\n'.join(f"- [{c['status']}] {c['name']} — {c['detail']}" for c in checks)+'\n',encoding='utf-8')
    print(f'PHASE 11 AUDIT: {passed}/{len(checks)} PASS')
    for c in checks: print(f"[{c['status']}] {c['name']} {c['detail']}")
    return 0 if failed==0 else 1
if __name__=='__main__': raise SystemExit(main())
