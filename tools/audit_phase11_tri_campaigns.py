#!/usr/bin/env python3
from __future__ import annotations
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
checks=[]

def add(name, ok, detail=''):
    checks.append({'name':name,'status':'PASS' if ok else 'FAIL','detail':str(detail)})

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def j(rel): return json.loads(read(rel))
def run(cmd):
    r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    return r.returncode==0,(r.stdout+'\n'+r.stderr)[-16000:]

def main():
    build=j('BUILD_INFO.json'); pkg=j('package.json'); manifest=j('manifest.json')
    index=read('index.html'); sw=read('service-worker.js'); app=read('js/app.js'); state=read('js/state.js'); campaign_screen=read('js/screens/campaign.js'); css=read('css/phase11-campaigns.css')
    campaigns=j('data/campaigns.json'); missions=j('data/missions.json'); nations=j('data/nations.json')
    add('metadata points to phase 11 retrofit', build.get('semver')=='2.0.0-alpha.26' and build.get('phase')=='11', build)
    add('package and manifest updated', pkg.get('version')=='2.0.0-alpha.26' and manifest.get('version')=='2.0.0-alpha.26', {'pkg':pkg.get('version'),'manifest':manifest.get('version')})
    add('service worker cache bumped', "CACHE_VERSION = '2.0.0-alpha.26'" in sw)
    add('index title and meta updated', 'v2.0.0-alpha.26' in index and 'fase 11' in index)
    add('phase 11 CSS still loaded and expanded', 'css/phase11-campaigns.css' in index and 'campaign-nation-tabs' in css and 'campaign-timeline' in css)
    nation_ids={n['id'] for n in nations}; mission_ids={m['id'] for m in missions}
    add('exactly three independent campaign nations', len(campaigns)==3 and {c['nationId'] for c in campaigns}==nation_ids, [c.get('nationId') for c in campaigns])
    for c in campaigns:
        mids=c.get('missionIds',[])
        add(f'{c["nationId"]} has eight ordered mission ids', len(mids)==8 and all(mid in mission_ids for mid in mids), mids)
        add(f'{c["nationId"]} has timeline and act map', len(c.get('timeline',[]))==4 and len(c.get('chapters',[]))==4)
        add(f'{c["nationId"]} chapters are isolated inside same campaign', all(set(ch.get('missionIds',[])).issubset(set(mids)) for ch in c.get('chapters',[])))
    add('state stores selected campaign preview nation', 'selectedCampaignNationId' in state and 'setCampaignNation' in state)
    add('app filters preview missions by selected nation', 'getCampaignViewNationId' in app and 'campaignViewMissions: missionsForNation(campaignViewNationId)' in app)
    add('wrong-nation launch guard exists', 'getCampaignViewNationId() !== getCurrentNationId()' in app and "toast.campaignCreateCommander" in app)
    add('campaign renderer includes three-nation selector', 'select-campaign-nation' in campaign_screen and 'campaign-nation-tabs' in campaign_screen)
    add('campaign renderer blocks other-nation launch visually', 'campaign.launchBlockedNation' in campaign_screen and 'previewOnlyHint' in campaign_screen)
    dicts={lang:j(f'data/translations/{lang}.json') for lang in ['pt-BR','en','es']}
    add('translation parity across PT/EN/ES', len({frozenset(d) for d in dicts.values()})==1, {k:len(v) for k,v in dicts.items()})
    required={'campaign.selectNationTitle','campaign.previewOnly','campaign.launchBlockedNation','campaign.timeline','campaign.actMap','toast.campaignCreateCommander'}
    for lang,d in dicts.items(): add(f'new campaign UI keys translated {lang}', required.issubset(set(d)), sorted(required-set(d)))
    ok,out=run(['node','--test','tests/campaigns.test.js']); add('campaign unit tests pass', ok, out)
    js_fail=[]
    for path in ROOT.glob('js/**/*.js'):
        ok,_=run(['node','--check',str(path.relative_to(ROOT))])
        if not ok: js_fail.append(str(path.relative_to(ROOT)))
    add('all JavaScript modules pass syntax check', not js_fail, js_fail[:20])
    passed=sum(c['status']=='PASS' for c in checks); failed=len(checks)-passed
    (ROOT/'reports').mkdir(exist_ok=True)
    report={'phase':'11','build':build,'summary':{'passed':passed,'failed':failed,'total':len(checks)},'checks':checks}
    (ROOT/'reports/phase11_tri_campaigns_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'reports/PHASE_11_TRI_CAMPAIGNS_AUDIT.md').write_text('# Phase 11 — Independent Campaigns Audit\n\n'+f'PASS: {passed}/{len(checks)}\n\n'+'\n'.join(f"- [{c['status']}] {c['name']} — {c['detail']}" for c in checks)+'\n',encoding='utf-8')
    print(f'PHASE 11 TRI-CAMPAIGNS AUDIT: {passed}/{len(checks)} PASS')
    for c in checks: print(f"[{c['status']}] {c['name']} {c['detail']}")
    return 0 if failed==0 else 1

if __name__=='__main__':
    raise SystemExit(main())
