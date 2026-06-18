#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke_test import build_harness

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "phase10_4_training_smoke.json"
SCREENSHOT_DIR = ROOT / "reports" / "screenshots"


def main() -> int:
    results = []
    errors = []

    def add(name: str, passed: bool, detail=""):
        results.append({"name": name, "pass": bool(passed), "detail": str(detail)})
        print(f"[{'PASS' if passed else 'FAIL'}] {name}{'' if passed or not detail else ': '+str(detail)[:400]}", flush=True)

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.getenv("CHROMIUM_PATH", "/usr/bin/chromium"))
        context = browser.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
        page = context.new_page()
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.set_content(build_harness(), wait_until="load", timeout=30000)
        page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)

        page.locator('[data-action="go-new-game"]').click()
        page.locator('#commander-name').fill('Comandante Treinamento')
        page.locator('[data-action="confirm-commander"]').click()
        page.locator('.commander-name').wait_for(timeout=7000)

        page.locator('.bottom-nav [data-nav="settings"]').click()
        add('Difficulty selector exists', page.locator('[data-setting-select="difficulty"]').count() == 1)
        add('Tutorial toggle exists', page.locator('[data-action="toggle-tutorials"]').count() == 1)
        add('Contextual help toggle exists', page.locator('[data-action="toggle-contextual-help"]').count() == 1)
        page.locator('[data-setting-select="difficulty"]').select_option('hardcore')
        add('Difficulty setting persists', page.evaluate("state.settings.difficulty") == 'hardcore', page.evaluate("state.settings"))

        page.locator('.bottom-nav [data-nav="campaign"]').click()
        page.locator('[data-action="open-briefing"]').click()
        page.locator('[data-action="start-mission"]').click()
        page.locator('.gameplay-screen').wait_for(timeout=10000)

        engine_difficulty = page.evaluate("document.getElementById('app').__simulationEngine.snapshot().difficulty")
        add('Engine receives selected difficulty', engine_difficulty.get('id') == 'hardcore', engine_difficulty)
        add('Difficulty badge visible', page.locator('.difficulty-badge').is_visible())
        add('Operational guide visible', page.locator('.operational-guide').is_visible())
        add('Nine tutorial steps rendered', page.locator('[data-training-step]').count() == 9, page.locator('[data-training-step]').count())
        add('Station help controls rendered', page.locator('#station-help-trigger').count() == 1, page.locator('#station-help-trigger').count())

        page.locator('#station-help-trigger').click()
        add('Contextual help drawer opens', page.locator('#station-help-drawer').get_attribute('aria-hidden') == 'false')
        help_text = page.locator('#station-help-body').inner_text()
        add('Contextual help contains operational guidance', len(help_text.strip()) > 40, help_text[:100])

        before = page.locator('[data-training-step].complete').count()
        progress = page.evaluate("""(()=>{
          const e=document.getElementById('app').__simulationEngine;
          e.stop();
          e.setSpeed('slow');
          e.adjustDepth(20);
          for(let i=0;i<180;i+=1)e.step(80);
          e.target.moveTo(0,-120);
          e.escort.moveTo(100,-220);
          e.physics.restore({...e.snapshot().physics,depth:8,orderedDepth:8,noise:2,cavitation:0});
          e.player.setDepth(8,300);
          e.sensors.state.hydrophoneBearing=0;
          e.sensors.observePassive(e.sensorContext());
          e.openPeriscope();
          for(let i=0;i<20;i+=1)e.step(80);
          e.emitState();
          return e.snapshot();
        })()""")
        page.wait_for_timeout(350)
        after = page.locator('[data-training-step].complete').count()
        add('Tutorial advances from real simulator actions', after > before, {'before': before, 'after': after, 'depth': progress['depth']})
        current_step = page.locator('#training-current-step').inner_text()
        add('Operational recommendation updates', len(current_step.strip()) > 4, current_step)

        profile_check = page.evaluate("""(()=>{
          const cadet=getDifficultyProfile('cadet');
          const hardcore=getDifficultyProfile('hardcore');
          return {
            cadetDetection:cadet.enemyDetectionMultiplier,
            hardcoreDetection:hardcore.enemyDetectionMultiplier,
            cadetDamage:cadet.enemyDamageMultiplier,
            hardcoreDamage:hardcore.enemyDamageMultiplier,
            cadetSensor:cadet.sensorConfidenceMultiplier,
            hardcoreSensor:hardcore.sensorConfidenceMultiplier
          };
        })()""")
        add('Difficulty profiles materially alter simulation', profile_check['cadetDetection'] < profile_check['hardcoreDetection'] and profile_check['cadetDamage'] < profile_check['hardcoreDamage'] and profile_check['cadetSensor'] > profile_check['hardcoreSensor'], profile_check)

        dims = page.evaluate("({scroll:document.documentElement.scrollWidth,inner:window.innerWidth})")
        add('Training UI has no horizontal overflow', dims['scroll'] <= dims['inner'] + 2, dims)
        page.screenshot(path=str(SCREENSHOT_DIR / 'phase10_4_mobile_training.png'), full_page=False)
        add('No page errors', len(errors) == 0, ' | '.join(errors))
        browser.close()

    passed = sum(1 for item in results if item['pass'])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results, 'errors': errors}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"PHASE 10.4 TRAINING SMOKE: {passed}/{len(results)} PASS")
    return 0 if passed == len(results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
