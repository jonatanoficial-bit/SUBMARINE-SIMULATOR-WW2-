#!/usr/bin/env python3
from __future__ import annotations
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke_test import build_harness

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'reports'/'phase10_3_operational_smoke.json'
SCREENSHOTS=ROOT/'reports'/'screenshots'

def main()->int:
    checks=[]; errors=[]
    def record(name,ok,details=''):
        checks.append({'name':name,'status':'PASS' if ok else 'FAIL','details':details})
    def create(page):
        page.locator('[data-action="go-new-game"]').click(); page.locator('#commander-name').fill('Operational QA'); page.locator('[data-action="confirm-commander"]').click(); page.locator('.commander-name').wait_for(timeout=7000)
        page.locator('.bottom-nav [data-nav="campaign"]').click(); page.locator('[data-action="open-briefing"]').click(); page.locator('[data-action="start-mission"]').click(); page.locator('.gameplay-screen').wait_for(timeout=10000)
    SCREENSHOTS.mkdir(parents=True,exist_ok=True)
    try:
        harness=build_harness()
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'))
            context=browser.new_context(viewport={'width':360,'height':640},device_scale_factor=1,is_mobile=True,has_touch=True)
            page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e))); page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.set_content(harness,wait_until='load',timeout=30000); page.locator('[data-action="go-new-game"]').wait_for(timeout=12000); create(page)
            env=page.evaluate("document.getElementById('app').__simulationEngine.snapshot().environment")
            record('Deterministic sea environment is mounted',env.get('environmentVersion')==1 and 0<=env.get('seaState',-1)<=6 and env.get('visibilityMeters',0)>=850,str(env))
            page.locator('[data-station="sensors"]').click()
            readouts=page.evaluate("""() => ({time:document.getElementById('environment-time').textContent,sea:document.getElementById('environment-sea-state').textContent,visibility:document.getElementById('environment-visibility').textContent,wind:document.getElementById('environment-wind').textContent,layer:document.getElementById('environment-layer').textContent,noise:document.getElementById('environment-noise').textContent})""")
            record('Environment console exposes six live readouts',all(v and not v.startswith('--') for v in readouts.values()),str(readouts))
            record('Acoustic waterfall is rendered with 18 history rows',page.locator('.hydrophone-waterfall-row').count()==18,str(page.locator('.hydrophone-waterfall-row').count()))
            fusion=page.evaluate("""() => {const e=document.getElementById('app').__simulationEngine;e.stop();e.target.moveTo(120,0);e.session.view={x:120,y:0};e.physics.restore({...e.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0,noise:2,cavitation:0});e.player.setDepth(5,300);e.openPeriscope();for(let i=0;i<12;i++)e.step(80);const visual=e.snapshot().sensors.contacts.target;e.closePeriscope();e.nudgeHydrophoneBearing(90);for(let i=0;i<28;i++)e.step(80);const fused=e.snapshot().sensors.contacts.target;e.emitState();return {visualSource:visual.source,visualUncertainty:visual.bearingUncertainty,fusedSource:fused.source,supporting:fused.supportingSource,fusedUncertainty:fused.bearingUncertainty,history:fused.history.length,trend:fused.trend,aspect:fused.aspect};}""")
            record('Precise visual solution survives weaker passive updates',fusion['visualSource']=='periscope' and fusion['fusedSource']=='periscope' and fusion['supporting']=='hydrophone' and fusion['fusedUncertainty']<=fusion['visualUncertainty']+0.01,str(fusion))
            record('Contact fusion produces bounded history and motion analysis',1<=fusion['history']<=12 and fusion['trend'] in ('closing','opening','steady') and fusion['aspect'] in ('bow','stern','crossing','unknown'),str(fusion))
            cards=page.evaluate("""() => ({signal:document.getElementById('sensor-target-signal').textContent,trend:document.getElementById('sensor-target-trend').textContent,speed:document.getElementById('sensor-target-speed').textContent,age:document.getElementById('sensor-target-age').textContent,markers:document.querySelectorAll('#sensor-target-history i').length})""")
            record('Sensor card exposes signal, trend, estimated speed, age and history',all(cards[k] and cards[k]!='--' for k in ('signal','trend','age')) and cards['markers']>0,str(cards))
            page.locator('#hydrophone-listen').click(); record('Hydrophone listening control remains interactive',not page.locator('#hydrophone-listen').is_disabled())
            page.evaluate("""() => {const e=document.getElementById('app').__simulationEngine;e.openPeriscope();e.emitState();}"""); page.locator('.periscope-modal').wait_for(state='visible',timeout=5000)
            optical=page.evaluate("""() => ({horizon:!!document.getElementById('periscope-horizon'),weather:document.getElementById('periscope-weather').dataset.active,visibility:getComputedStyle(document.getElementById('periscope-visibility-layer')).opacity,quality:document.getElementById('periscope-visual-quality').textContent,sea:document.getElementById('periscope-sea-state').textContent,targetHidden:document.getElementById('target-ship').classList.contains('hidden')})""")
            record('Periscope renders horizon, weather, visibility and live sea data',optical['horizon'] and optical['quality'].endswith('%') and '/6' in optical['sea'] and optical['visibility']!='',str(optical))
            record('Optical target presentation respects field of view and range',not optical['targetHidden'],str(optical))
            page.locator('.periscope-modal').screenshot(path=str(SCREENSHOTS/'phase10_3_mobile_periscope.png'),timeout=15000); page.locator('#close-periscope').click()
            page.locator('[data-station="sensors"]').click(); page.locator('.sensor-panel').screenshot(path=str(SCREENSHOTS/'phase10_3_mobile_sensors.png'),timeout=15000)
            dims=page.evaluate("""() => ({viewport:innerWidth,body:document.documentElement.scrollWidth,shellClient:document.querySelector('.app-shell').clientWidth,shellScroll:document.querySelector('.app-shell').scrollWidth})""")
            record('Operational console has no mobile horizontal overflow',dims['body']<=dims['viewport']+1 and dims['shellScroll']<=dims['shellClient']+1,str(dims))
            page.evaluate("document.querySelector('.app-shell').scrollTop=0")
            cdp=context.new_cdp_session(page); cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':342,'y':560,'radiusX':3,'radiusY':3,'force':1}]})
            for y in [500,430,360,290,220,150]: cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':342,'y':y,'radiusX':3,'radiusY':3,'force':1}]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); page.wait_for_timeout(500)
            record('Mobile touch scrolling remains functional with realism panels',page.evaluate("document.querySelector('.app-shell').scrollTop")>70,str(page.evaluate("document.querySelector('.app-shell').scrollTop")))
            context.close()
            desktop=browser.new_context(viewport={'width':1366,'height':768}); d=desktop.new_page(); d.on('pageerror',lambda e:errors.append(str(e))); d.set_content(harness,wait_until='load',timeout=30000); d.locator('[data-action="go-new-game"]').wait_for(timeout=12000); create(d); d.locator('[data-station="sensors"]').click(); cols=d.locator('.environment-strip').evaluate('el=>getComputedStyle(el).gridTemplateColumns'); overflow=d.evaluate('document.documentElement.scrollWidth-window.innerWidth'); record('Desktop environment strip expands to six columns without overflow',len(cols.split())==6 and overflow<=1,f'{cols}; overflow={overflow}'); d.evaluate("document.getElementById('app').__simulationEngine.stop()"); desktop.close(); browser.close()
    except Exception as exc: record('Operational realism browser execution',False,repr(exc))
    harmful=[e for e in errors if 'Failed to load resource' not in e and 'Not allowed to load local resource' not in e]
    record('No uncaught browser errors',not harmful,' | '.join(harmful[:10]))
    passed=sum(c['status']=='PASS' for c in checks); failed=sum(c['status']=='FAIL' for c in checks)
    REPORT.parent.mkdir(parents=True,exist_ok=True); REPORT.write_text(json.dumps({'summary':{'passed':passed,'failed':failed},'checks':checks,'consoleErrors':errors},ensure_ascii=False,indent=2)+'\n')
    print(f'OPERATIONAL REALISM SMOKE {"PASS" if failed==0 else "FAIL"}: {passed} passed, {failed} failed')
    for c in checks: print(f"[{c['status']}] {c['name']} {c['details']}")
    return 0 if failed==0 else 1
if __name__=='__main__': raise SystemExit(main())
