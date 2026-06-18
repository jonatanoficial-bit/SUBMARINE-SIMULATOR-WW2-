#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke_test import build_harness

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports' / 'phase10_1_stabilization_smoke.json'
SCREENSHOTS = ROOT / 'reports' / 'screenshots'


def main() -> int:
    checks: list[dict] = []
    errors: list[str] = []

    def record(name: str, ok: bool, details: str = '') -> None:
        checks.append({'name': name, 'status': 'PASS' if ok else 'FAIL', 'details': details})

    def create_commander(page) -> None:
        page.locator('[data-action="go-new-game"]').click()
        page.locator('#commander-name').fill('Commander Stabilization')
        page.locator('[data-action="confirm-commander"]').click()
        page.locator('.commander-name').wait_for(timeout=7000)

    def enter_gameplay(page) -> None:
        page.locator('.bottom-nav [data-nav="campaign"]').click()
        page.locator('[data-action="open-briefing"]').click()
        page.locator('[data-action="start-mission"]').click()
        page.locator('.gameplay-screen').wait_for(timeout=10000)

    def station(page, name: str) -> None:
        page.locator(f'[data-station="{name}"]').click()
        page.locator(f'[data-station-panel="{name}"].active').first.wait_for(timeout=4000)

    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    try:
        harness = build_harness()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'))
            context = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=1, is_mobile=True, has_touch=True)
            page = context.new_page()
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            page.set_content(harness, wait_until='load', timeout=30000)
            page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)
            create_commander(page)
            enter_gameplay(page)

            metrics = page.evaluate("""() => {
              const shell=document.querySelector('.app-shell');
              return {client:shell.clientHeight, scroll:shell.scrollHeight, body:document.body.scrollHeight, overflow:getComputedStyle(shell).overflowY};
            }""")
            record('Gameplay uses a dedicated mobile scroll container', metrics['scroll'] > metrics['client'] and metrics['overflow'] == 'auto', str(metrics))
            record('Gameplay document is no longer one giant 10k-pixel page', metrics['body'] <= 700, str(metrics))

            station(page, 'instruments')
            page.evaluate("document.querySelector('.app-shell').scrollTop=0")
            cdp = context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 180, 'y': 520, 'radiusX': 4, 'radiusY': 4, 'force': 1}]})
            for y in [470, 420, 370, 320, 270, 220, 170]:
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 180, 'y': y, 'radiusX': 4, 'radiusY': 4, 'force': 1}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            page.wait_for_timeout(300)
            scroll_top = page.evaluate("document.querySelector('.app-shell').scrollTop")
            record('Real touch swipe scrolls the mobile gameplay screen', scroll_top > 80, str(scroll_top))

            tabs = page.locator('.station-tab').count()
            visible_panels = page.locator('.station-panel.active').count()
            record('Combat is divided into seven readable stations', tabs == 7, f'tabs={tabs}')
            record('Only the selected station is expanded', visible_panels == 2, f'active panels={visible_panels}')

            page.evaluate("document.querySelector('.app-shell').scrollTop=0")
            initial = page.evaluate("""() => ({
              depth:document.getElementById('depth-digital').textContent,
              order:document.getElementById('depth-order-digital').textContent,
              speed:document.getElementById('speed-actual-digital').textContent,
              command:document.getElementById('speed-command-digital').textContent,
              needle:document.getElementById('depth-needle').style.transform,
              marker:document.getElementById('depth-command-marker').style.transform
            })""")
            page.locator('#depth-down').click()
            page.locator('.speed-chip[data-speed="flank"]').click()
            after_order = page.evaluate("""() => ({
              depth:document.getElementById('depth-digital').textContent,
              order:document.getElementById('depth-order-digital').textContent,
              speed:document.getElementById('speed-actual-digital').textContent,
              command:document.getElementById('speed-command-digital').textContent,
              needle:document.getElementById('depth-needle').style.transform,
              marker:document.getElementById('depth-command-marker').style.transform
            })""")
            page.evaluate("""() => { const e=document.getElementById('app').__simulationEngine; e.stop(); for(let i=0;i<80;i+=1)e.step(80); }""")
            progressed = page.evaluate("""() => ({
              depth:document.getElementById('depth-digital').textContent,
              order:document.getElementById('depth-order-digital').textContent,
              speed:document.getElementById('speed-actual-digital').textContent,
              command:document.getElementById('speed-command-digital').textContent,
              needle:document.getElementById('depth-needle').style.transform,
              marker:document.getElementById('depth-command-marker').style.transform,
              hud:document.getElementById('hud-speed').textContent
            })""")
            record('Depth gauge separates actual depth from ordered depth', initial['order'] != after_order['order'] and after_order['depth'].split()[0] != after_order['order'].split()[1] and progressed['depth'] != after_order['depth'] and progressed['order'] == after_order['order'], str({'initial':initial,'ordered':after_order,'progressed':progressed}))
            record('Depth needle and command marker move independently', after_order['marker'] != initial['marker'] and progressed['needle'] != initial['needle'], str({'initial':initial,'ordered':after_order,'progressed':progressed}))
            record('Speed gauge separates telegraph command from actual knots', after_order['command'] != initial['command'] and float(after_order['speed'].split()[0]) < 12 and float(progressed['speed'].split()[0]) > float(after_order['speed'].split()[0]) and 'kn' in progressed['hud'], str({'initial':initial,'ordered':after_order,'progressed':progressed}))
            page.locator('.physics-panel').screenshot(path=str(SCREENSHOTS / 'phase10_1_mobile_instruments.png'))

            station(page, 'command')
            page.evaluate("""() => { const e=document.getElementById('app').__simulationEngine; e.stop(); e.physics.restore({...e.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0}); e.player.setDepth(5,300); e.emitState(); }""")
            page.locator('#open-periscope').click()
            page.locator('.periscope-modal').wait_for(state='visible', timeout=5000)
            scope_before = page.evaluate("""() => ({zoom:document.getElementById('periscope-zoom-value').textContent,bearing:document.getElementById('periscope-bearing').textContent,range:document.getElementById('periscope-range').textContent,exposure:document.getElementById('periscope-exposure').textContent})""")
            page.locator('#periscope-zoom-in').click()
            scope_after = page.evaluate("""() => ({zoom:document.getElementById('periscope-zoom-value').textContent,bearing:document.getElementById('periscope-bearing').textContent,range:document.getElementById('periscope-range').textContent,exposure:document.getElementById('periscope-exposure').textContent})""")
            record('Periscope exposes bearing, range, zoom and exposure instruments', all(scope_before.values()), str(scope_before))
            record('Periscope zoom control changes the optical scale', scope_after['zoom'] != scope_before['zoom'], str({'before':scope_before,'after':scope_after}))
            scope_box = page.locator('.periscope-window').bounding_box()
            if scope_box:
                page.mouse.move(scope_box['x'] + scope_box['width'] * .65, scope_box['y'] + scope_box['height'] * .5)
                page.mouse.down()
                page.mouse.move(scope_box['x'] + scope_box['width'] * .35, scope_box['y'] + scope_box['height'] * .42, steps=6)
                page.mouse.up()
            drag_bearing = page.locator('#periscope-bearing').inner_text()
            record('Periscope supports direct drag/pan instead of buttons only', bool(scope_box) and drag_bearing != scope_after['bearing'], f"{scope_after['bearing']} -> {drag_bearing}")
            page.locator('.periscope-modal').screenshot(path=str(SCREENSHOTS / 'phase10_1_mobile_periscope.png'))
            page.locator('#close-periscope').click()

            station(page, 'command')
            page.locator('.gameplay-screen').screenshot(path=str(SCREENSHOTS / 'phase10_1_mobile_command.png'))

            # Balance is tested through the same browser-loaded engine.
            balance = page.evaluate("""() => {
              const live=document.getElementById('app').__simulationEngine; live.stop();
              const submarine=live.player.metadata?.submarine || {id:'qa-sub',stats:{stealth:76,range:74}};
              const quietEngine=new SimulationEngine({mission:live.mission,submarine}); quietEngine.stop();
              quietEngine.physics.restore({...quietEngine.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0,noise:2,cavitation:0,battery:100,oxygen:100,co2:1}); quietEngine.player.setDepth(5,300);
              for(let i=0;i<750;i+=1)quietEngine.step(80); const quiet=quietEngine.snapshot();
              const exposed=new SimulationEngine({mission:live.mission,submarine}); exposed.stop();
              exposed.physics.restore({...exposed.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0,noise:2,cavitation:0,battery:100,oxygen:100,co2:1}); exposed.player.setDepth(5,300); exposed.openPeriscope();
              let firstDamage=null; for(let i=0;i<1875;i+=1){exposed.step(80); if(firstDamage===null && exposed.snapshot().metrics.damageTaken>0) firstDamage=(i+1)*.08;}
              const exposure=exposed.snapshot(); quietEngine.dispose(); exposed.dispose();
              return {quiet:{detection:quiet.detectionScore,damage:quiet.metrics.damageTaken,patterns:quiet.navalAI.metrics.patternsDropped},periscopeFirstDamage:firstDamage,exposure:{detection:exposure.detectionScore,patterns:exposure.navalAI.metrics.patternsDropped,ai:exposure.navalAI.globalState}};
            }""")
            record('Quiet patrol remains safe for the first simulated minute', balance['quiet']['detection'] < 28 and balance['quiet']['damage'] == 0, str(balance))
            record('Continuous periscope exposure gives reaction time before damage', balance['periscopeFirstDamage'] is not None and 50 <= balance['periscopeFirstDamage'] <= 140, str(balance))

            context.close()
            browser.close()
    except Exception as exc:
        record('Stabilization browser execution', False, repr(exc))

    harmful = [item for item in errors if 'Failed to load resource' not in item and 'Not allowed to load local resource' not in item]
    record('No uncaught browser errors', not harmful, ' | '.join(harmful[:10]))
    passed = sum(item['status'] == 'PASS' for item in checks)
    failed = sum(item['status'] == 'FAIL' for item in checks)
    result = {'summary': {'passed': passed, 'failed': failed}, 'checks': checks, 'consoleErrors': errors}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"STABILIZATION SMOKE {'PASS' if failed == 0 else 'FAIL'}: {passed} passed, {failed} failed")
    for item in checks:
        print(f"[{item['status']}] {item['name']} {item['details']}")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
