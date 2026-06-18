#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke_test import build_harness

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports' / 'phase10_2_tactical_smoke.json'
SCREENSHOTS = ROOT / 'reports' / 'screenshots'


def main() -> int:
    checks: list[dict] = []
    errors: list[str] = []

    def record(name: str, ok: bool, details: str = '') -> None:
        checks.append({'name': name, 'status': 'PASS' if ok else 'FAIL', 'details': details})

    def create_commander(page) -> None:
        page.locator('[data-action="go-new-game"]').click()
        page.locator('#commander-name').fill('Commander Tactical QA')
        page.locator('[data-action="confirm-commander"]').click()
        page.locator('.commander-name').wait_for(timeout=7000)

    def enter_gameplay(page) -> None:
        page.locator('.bottom-nav [data-nav="campaign"]').click()
        page.locator('[data-action="open-briefing"]').click()
        page.locator('[data-action="start-mission"]').click()
        page.locator('.gameplay-screen').wait_for(timeout=10000)

    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    try:
        harness = build_harness()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'))
            mobile = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=1, is_mobile=True, has_touch=True)
            page = mobile.new_page()
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            page.set_content(harness, wait_until='load', timeout=30000)
            page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)
            create_commander(page)
            enter_gameplay(page)

            dimensions = page.evaluate("""() => ({
              viewport: window.innerWidth,
              body: document.body.scrollWidth,
              shellClient: document.querySelector('.app-shell').clientWidth,
              shellScroll: document.querySelector('.app-shell').scrollWidth,
              consoleTop: Math.round(document.querySelector('.encounter-console').getBoundingClientRect().top)
            })""")
            record('Tactical encounter console fits 360px mobile width', dimensions['shellScroll'] <= dimensions['shellClient'] + 1 and dimensions['body'] <= dimensions['viewport'] + 1, str(dimensions))
            record('Tactical console is visible near the command station', dimensions['consoleTop'] < 620, str(dimensions))
            record('Four tactical doctrines are available', page.locator('.encounter-doctrine').count() == 4, str(page.locator('.encounter-doctrine').count()))

            page.locator('.encounter-doctrine[data-doctrine="attack"]').click()
            doctrine = page.evaluate("""() => ({
              active: document.querySelector('.encounter-doctrine[data-doctrine="attack"]').classList.contains('active'),
              engine: document.getElementById('app').__simulationEngine.snapshot().encounter.doctrine,
              phase: document.getElementById('encounter-phase').dataset.phase
            })""")
            record('Doctrine controls update engine and UI together', doctrine['active'] and doctrine['engine'] == 'attack', str(doctrine))

            initial_gate = page.evaluate("""() => {
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.physics.restore({...e.snapshot().physics,depth:90,orderedDepth:90,verticalSpeed:0,noise:2,cavitation:0,battery:100,oxygen:100,co2:1});
              e.player.setDepth(90,300); e.setSpeed('slow'); e.activateSilentRunning();
              e.session.detectionScore=38; e.navalAI.notifyTorpedoLaunch([]);
              e.resolveWeaponShot({targetRole:'target',outcome:'hit'}); e.closePeriscope(); e.step(80); e.emitState();
              const s=e.snapshot();
              return {targetDestroyed:s.targetDestroyed, canComplete:s.canComplete, phase:s.encounter.phase, buttonHidden:document.getElementById('complete-mission-btn').classList.contains('hidden')};
            }""")
            record('Target destruction does not end mission immediately', initial_gate['targetDestroyed'] and not initial_gate['canComplete'] and initial_gate['phase'] == 'evade' and initial_gate['buttonHidden'], str(initial_gate))

            completion = page.evaluate("""() => {
              const e=document.getElementById('app').__simulationEngine;
              e.session.detectionScore=0;
              e.navalAI.state.hostileActionAgeMs=999999;
              e.navalAI.state.contactConfidence=0;
              e.navalAI.state.attackSolution=0;
              e.navalAI.state.depthChargePatterns=[];
              e.navalAI.setGlobalState('regroup',{force:true});
              for(let i=0;i<300;i+=1)e.step(80);
              const s=e.snapshot();
              return {canComplete:s.canComplete, phase:s.encounter.phase, escape:s.encounter.escapeProgress, ai:s.navalAI.globalState, buttonHidden:document.getElementById('complete-mission-btn').classList.contains('hidden')};
            }""")
            record('Verified disengagement unlocks mission completion only after safety window', completion['canComplete'] and completion['phase'] == 'complete' and completion['escape'] == 100 and not completion['buttonHidden'], str(completion))

            readouts = page.evaluate("""() => ({
              contact:document.getElementById('encounter-contact-quality').textContent,
              readiness:document.getElementById('encounter-attack-readiness').textContent,
              enemy:document.getElementById('encounter-enemy-solution').textContent,
              escape:document.getElementById('encounter-escape-progress').textContent,
              recommendation:document.getElementById('encounter-recommendation').textContent
            })""")
            record('Tactical readouts expose contact, readiness, enemy solution and escape', all(readouts.values()) and readouts['escape'] == '100%', str(readouts))
            page.locator('.gameplay-screen').screenshot(path=str(SCREENSHOTS / 'phase10_2_mobile_tactical.png'))

            # Restart a live tactical view for periscope visibility/FOV validation.
            page.evaluate("""() => {
              const e=document.getElementById('app').__simulationEngine;
              e.session.missionFailed=false; e.session.canComplete=false;
              e.target.destroyed=false; e.target.moveTo(100,0); e.session.view={x:100,y:0};
              e.physics.restore({...e.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0}); e.player.setDepth(5,300);
              e.sensors.state.contacts.target={...e.sensors.state.contacts.target,detected:true,confidence:90,rangeKnown:true,rangeMeters:600,stale:false};
              e.openPeriscope(); e.emitState();
            }""")
            page.locator('.periscope-modal').wait_for(state='visible', timeout=5000)
            page.evaluate("""() => {const e=document.getElementById('app').__simulationEngine; for(let i=0;i<70;i+=1)e.step(80);}""")
            scope = page.evaluate("""() => ({
              mast:document.getElementById('periscope-mast-time').textContent,
              bearing:document.getElementById('periscope-bearing').textContent,
              distance:document.getElementById('periscope-range').textContent,
              targetHidden:document.getElementById('target-ship').classList.contains('hidden')
            })""")
            record('Periscope shows live mast exposure, bearing and range', scope['mast'] != '0 s' and bool(scope['bearing']) and bool(scope['distance']), str(scope))
            record('Detected target is shown only inside optical field of view', not scope['targetHidden'], str(scope))
            page.locator('.periscope-modal').screenshot(path=str(SCREENSHOTS / 'phase10_2_mobile_periscope.png'))
            page.locator('#close-periscope').click()

            # Regression: real touch scrolling remains functional after tactical additions.
            page.evaluate("document.querySelector('.app-shell').scrollTop=0")
            cdp = mobile.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 342, 'y': 560, 'radiusX': 3, 'radiusY': 3, 'force': 1}]})
            for y in [500, 440, 380, 320, 260, 200, 140]:
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 342, 'y': y, 'radiusX': 3, 'radiusY': 3, 'force': 1}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            page.wait_for_timeout(500)
            scroll_top = page.evaluate("document.querySelector('.app-shell').scrollTop")
            record('Mobile touch scrolling remains functional', scroll_top > 80, str(scroll_top))

            mobile.close()

            desktop = browser.new_context(viewport={'width': 1366, 'height': 768}, device_scale_factor=1)
            desktop_page = desktop.new_page()
            desktop_page.on('pageerror', lambda exc: errors.append(str(exc)))
            desktop_page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            desktop_page.set_content(harness, wait_until='load', timeout=30000)
            desktop_page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)
            create_commander(desktop_page)
            enter_gameplay(desktop_page)
            desktop_metrics = desktop_page.evaluate("""() => ({
              width:document.querySelector('.gameplay-screen').getBoundingClientRect().width,
              viewport:window.innerWidth,
              overflow:document.documentElement.scrollWidth-window.innerWidth,
              consoleVisible:!!document.querySelector('.encounter-console')
            })""")
            record('Desktop tactical layout uses available width without overflow', desktop_metrics['consoleVisible'] and desktop_metrics['width'] > 900 and desktop_metrics['overflow'] <= 1, str(desktop_metrics))
            desktop_page.locator('.gameplay-screen').screenshot(path=str(SCREENSHOTS / 'phase10_2_desktop_tactical.png'))
            desktop.close()
            browser.close()
    except Exception as exc:
        record('Tactical browser execution', False, repr(exc))

    harmful = [item for item in errors if 'Failed to load resource' not in item and 'Not allowed to load local resource' not in item]
    record('No uncaught browser errors', not harmful, ' | '.join(harmful[:10]))
    passed = sum(item['status'] == 'PASS' for item in checks)
    failed = sum(item['status'] == 'FAIL' for item in checks)
    result = {'summary': {'passed': passed, 'failed': failed}, 'checks': checks, 'consoleErrors': errors}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"TACTICAL SMOKE {'PASS' if failed == 0 else 'FAIL'}: {passed} passed, {failed} failed")
    for item in checks:
        print(f"[{item['status']}] {item['name']} {item['details']}")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
