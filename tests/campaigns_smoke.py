#!/usr/bin/env python3
from __future__ import annotations
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke_test import build_harness
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'reports'/'phase11_campaigns_smoke.json'
SCREENSHOTS=ROOT/'reports'/'screenshots'

def main():
    checks=[]; errors=[]
    def add(name,ok,detail=''):
        checks.append({'name':name,'status':'PASS' if ok else 'FAIL','detail':str(detail)})
        print(f"[{'PASS' if ok else 'FAIL'}] {name} {'' if ok else str(detail)[:300]}", flush=True)
    SCREENSHOTS.mkdir(parents=True,exist_ok=True)
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'))
            context=browser.new_context(viewport={'width':360,'height':640},is_mobile=True,has_touch=True)
            page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e))); page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.set_content(build_harness(),wait_until='load',timeout=30000)
            page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)
            for nation, caption in [('de','Kriegsmarine'),('uk','Royal Navy'),('us','US Navy')]:
                page.locator('[data-action="go-new-game"]').click()
                page.locator(f'[data-action="select-nation"][data-nation="{nation}"]').click()
                page.locator('#commander-name').fill(f'Campaign {nation}')
                page.locator('[data-action="confirm-commander"]').click()
                page.locator('.commander-name').wait_for(timeout=7000)
                page.locator('.bottom-nav [data-nav="campaign"]').click()
                page.locator('.phase11-campaign-screen').wait_for(timeout=6000)
                title=page.locator('.screen-subtitle').inner_text()
                cards=page.locator('.phase11-mission-list .mission-card').count()
                available=page.locator('.phase11-mission-list .mission-card:not(.locked)').count()
                add(f'{nation} campaign title rendered', caption in title or nation.upper() in title, title)
                add(f'{nation} renders eight missions', cards==8, cards)
                add(f'{nation} starts with one available mission', available==1, available)
                add(f'{nation} campaign overview is visible', page.locator('.phase11-campaign-overview').is_visible())
                add(f'{nation} has no mobile overflow', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
                # Reset profile and local save for next nation using app actions
                page.locator('.bottom-nav [data-nav="settings"]').click(); page.locator('[data-action="reset-progress"]').click()
                page.locator('[data-action="go-new-game"]').wait_for(timeout=6000)
            # Specific unlock: create German, complete first in engine path via direct app action on report impossible; inspect by selecting first and entering briefing
            page.screenshot(path=str(SCREENSHOTS/'phase11_mobile_campaigns.png'),full_page=False)
            context.close(); browser.close()
    except Exception as exc:
        add('Phase 11 campaign smoke execution',False,repr(exc))
    harmful=[e for e in errors if 'Failed to load resource' not in e]
    add('No uncaught browser errors',not harmful,' | '.join(harmful[:8]))
    passed=sum(c['status']=='PASS' for c in checks); failed=len(checks)-passed
    REPORT.write_text(json.dumps({'summary':{'passed':passed,'failed':failed,'total':len(checks)},'checks':checks,'errors':errors},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'PHASE 11 CAMPAIGNS SMOKE: {passed}/{len(checks)} PASS')
    return 0 if failed==0 else 1
if __name__=='__main__': raise SystemExit(main())
