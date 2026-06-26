#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "phase10_4_regression_smoke.json"
SCREENSHOT_DIR = ROOT / "reports" / "screenshots"
BUILD_INFO = json.loads((ROOT / "BUILD_INFO.json").read_text(encoding="utf-8"))
PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
MODULE_ORDER = [
    "js/build.js", "js/utils/sanitize.js", "js/state.js", "js/save.js", "js/i18n.js",
    "js/dataLoader.js", "js/safety.js", "js/audio.js", "js/components/ui.js",
    "js/engine/core/EventBus.js", "js/engine/core/SimulationClock.js",
    "js/engine/navigation/NavigationSystem.js", "js/engine/physics/SubmarinePhysicsSystem.js",
    "js/engine/sensors/SensorSystem.js",
    "js/engine/weapons/WeaponSystem.js",
    "js/engine/ai/NavalAISystem.js",
    "js/engine/damage/DamageControlSystem.js",
    "js/engine/tactical/TacticalEncounterSystem.js",
    "js/engine/environment/EnvironmentSystem.js",
    "js/engine/training/DifficultyProfile.js",
    "js/engine/training/OperationalTraining.js",
    "js/engine/simulation/constants.js", "js/engine/simulation/simulationMath.js",
    "js/engine/entities/Entity.js", "js/engine/entities/SubmarineEntity.js", "js/engine/entities/ShipEntity.js",
    "js/engine/simulation/SimulationEngine.js", "js/engine/scenes/SceneManager.js",
    "js/systems/crewReadiness.js", "js/systems/convoyDoctrine.js", "js/systems/campaignDoctrine.js", "js/systems/campaignObjectives.js", "js/systems/campaignConsequences.js", "js/systems/highCommandOrders.js", "js/systems/campaignEvents.js", "js/systems/specialOperations.js", "js/systems/operationChains.js", "js/systems/operationOutcomes.js", "js/systems/operationalHonors.js", "js/systems/commandAdvancement.js", "js/systems/veteranOfficers.js", "js/systems/crewDrills.js", "js/systems/silentDepthPeriscope.js", "js/systems/commandRoomImmersion.js", "js/systems/subOfficerCopilot.js", "js/systems/alertAtmosphere.js", "js/systems/airAttackEvasion.js", "js/systems/tacticalNavalChart.js", "js/systems/waypointNavigation.js", "js/systems/visualHorizonContacts.js", "js/systems/torpedoAttackDirector.js", "js/systems/navalAITacticalCoordinator.js", "js/systems/submarineDamageVisuals.js", "js/systems/depthStealthRealism.js", "js/systems/cinematicInterface.js", "js/systems/immersiveAudioDirector.js", "js/systems/cinematicBriefing.js", "js/systems/livingCrewRoles.js", "js/systems/livingCampaignFront.js", "js/oceanWeather.js",
    "js/screens/splash.js", "js/screens/mainMenu.js", "js/screens/commander.js",
    "js/screens/lobby.js", "js/screens/campaign.js", "js/screens/career.js", "js/screens/strategy.js", "js/screens/bridge.js", "js/screens/arsenal.js", "js/screens/crew.js",
    "js/screens/settings.js", "js/screens/profiles.js", "js/screens/briefing.js", "js/screens/gameplay.js", "js/app.js",
]
CSS_ORDER = [
    "css/reset.css", "css/variables.css", "css/base.css", "css/layout.css", "css/components.css",
    "css/screens.css", "css/responsive.css", "css/phase2-responsive.css", "css/phase3-engine.css",
    "css/phase4-save.css", "css/phase5-navigation.css", "css/phase6-physics.css", "css/phase7-sensors.css", "css/phase8-weapons.css", "css/phase9-ai.css", "css/phase10-damage.css", "css/phase10-1-stabilization.css", "css/phase10-2-tactical.css", "css/phase10-3-realism.css", "css/phase10-4-training.css", "css/phase11-campaigns.css", "css/phase12-career-logistics.css", "css/phase12-campaign-doctrines.css", "css/phase13-strategic-command.css", "css/phase13-campaign-objectives.css", "css/phase14-campaign-consequences.css", "css/phase15-high-command-orders.css", "css/phase16-campaign-events.css", "css/phase17-special-operations.css", "css/phase18-operation-chains.css", "css/phase19-operation-outcomes.css", "css/phase20-operational-honors.css", "css/phase21-command-advancement.css", "css/phase22-veteran-officers.css", "css/phase14-bridge-instruments.css", "css/phase15-command-room.css", "css/phase16-buoyancy-depth.css", "css/phase17-sonar-room.css", "css/phase18-periscope-optics.css", "css/phase19-tdc-fire-control.css", "css/phase20-mobile-scroll.css", "css/phase21-damage-emergency.css", "css/phase23-crew-readiness.css", "css/phase23-crew-drills.css", "css/phase24-ocean-weather.css", "css/phase24-silent-depth-periscope.css", "css/phase25-convoy-doctrine.css", "css/phase25-silent-depth-command-room.css", "css/phase26-subofficer-copilot.css", "css/phase27-alert-atmosphere.css", "css/phase28-air-attack-evasion.css", "css/phase29-tactical-naval-chart.css", "css/phase30-waypoint-navigation.css", "css/phase31-visual-horizon-contacts.css", "css/phase32-torpedo-attack-director.css", "css/phase33-naval-ai-tactics.css", "css/phase34-damage-visual-states.css", "css/phase35-depth-stealth-realism.css", "css/phase36-cinematic-interface.css", "css/phase37-immersive-audio.css", "css/phase38-cinematic-briefing.css", "css/phase39-crew-roles.css", "css/phase40-living-campaign.css", "css/phase41-flow-subofficer-periscope.css",
]


def strip_module_syntax(source: str) -> str:
    source = re.sub(r"^\s*import\s+[\s\S]*?\s+from\s+['\"][^'\"]+['\"]\s*;\s*", "", source, flags=re.MULTILINE)
    return re.sub(r"\bexport\s+", "", source)


def build_harness() -> str:
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    index = re.sub(r"\s*<link rel=\"stylesheet\"[^>]+>", "", index)
    index = re.sub(r"\s*<link rel=\"manifest\"[^>]+>", "", index)
    index = re.sub(r"\s*<link rel=\"icon\"[^>]+>", "", index)
    index = re.sub(r"\s*<link rel=\"apple-touch-icon\"[^>]+>", "", index)
    index = re.sub(r"\s*<script type=\"module\" src=\"js/app.js\"></script>", "", index)
    css = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in CSS_ORDER)
    index = index.replace("</head>", f"<style>{css}\n/* smoke-disable-animations */\n*,*::before,*::after{{animation:none!important;transition:none!important;}} .phase36-cinematic-layer{{display:none!important;}}</style></head>")
    paths = [
        "data/nations.json", "data/submarines.json", "data/crew.json", "data/missions.json", "data/campaigns.json", "data/campaign_doctrines.json", "data/campaign_objectives.json", "data/campaign_consequences.json", "data/high_command_orders.json", "data/campaign_events.json", "data/special_operations.json", "data/operation_chains.json", "data/operation_outcomes.json", "data/operational_honors.json", "data/command_advancement.json", "data/veteran_officers.json", "data/crew_drills.json", "data/logistics.json", "data/strategy.json", "data/upgrades.json",
        "data/translations/pt-BR.json", "data/translations/en.json", "data/translations/es.json",
    ]
    data_map = {path: json.loads((ROOT / path).read_text(encoding="utf-8")) for path in paths}
    modules = "\n\n".join(f"/* {path} */\n{strip_module_syntax((ROOT / path).read_text(encoding='utf-8'))}" for path in MODULE_ORDER)
    modules = modules.replace("if ('serviceWorker' in navigator)", "if (false)")
    prelude = f"""
<script>
'use strict';
const __storageData = Object.create(null);
const localStorage = {{
  getItem(key) {{ return Object.prototype.hasOwnProperty.call(__storageData,key) ? __storageData[key] : null; }},
  setItem(key,value) {{ __storageData[key]=String(value); }}, removeItem(key) {{ delete __storageData[key]; }},
  clear() {{ Object.keys(__storageData).forEach((key)=>delete __storageData[key]); }},
  key(index) {{ return Object.keys(__storageData)[index] || null; }}, get length() {{ return Object.keys(__storageData).length; }}
}};
window.__testStorage=localStorage;
const __TEST_DATA={json.dumps(data_map, ensure_ascii=False)};
const fetch=async(input)=>{{
 const raw=typeof input==='string'?input:input?.url||String(input); const key=raw.startsWith('./')?raw.slice(2):raw;
 if(Object.prototype.hasOwnProperty.call(__TEST_DATA,key)) return new Response(JSON.stringify(__TEST_DATA[key]),{{status:200,headers:{{'content-type':'application/json'}}}});
 return new Response('Not found',{{status:404}});
}};
window.fetch=fetch; window.confirm=()=>true;
{modules}
</script>
"""
    index = index.replace("</body>", prelude + "</body>")
    return re.sub(r"assets/[a-zA-Z0-9_./-]+\.(?:png|webp|jpe?g|svg)", PLACEHOLDER, index)


def main() -> int:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    checks: list[dict] = []
    errors: list[str] = []

    def record(name: str, condition: bool, details: str = "") -> None:
        checks.append({"name": name, "status": "PASS" if condition else "FAIL", "details": details})
        print(f"[{'PASS' if condition else 'FAIL'}] {name}{'' if condition or not details else ': ' + details[:500]}", flush=True)

    def no_overflow(page) -> bool:
        return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

    def boot(page) -> None:
        page.set_content(build_harness(), wait_until="domcontentloaded", timeout=30000)
        page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)

    def create_commander(page, name="Commander QA") -> None:
        page.locator('[data-action="go-new-game"]').click()
        page.locator('#commander-name').fill(name)
        page.locator('[data-action="confirm-commander"]').click()
        page.locator('.commander-name').wait_for(timeout=7000)

    def enter_gameplay(page) -> None:
        page.locator('.bottom-nav [data-nav="campaign"]').click()
        page.locator('[data-action="open-briefing"]').click()
        page.locator('[data-action="start-mission"]').click()
        page.locator('.gameplay-screen').wait_for(timeout=10000)

    try:
        harness = build_harness()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, executable_path=os.getenv("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-dev-shm-usage", "--use-gl=swiftshader"])

            phone = browser.new_context(viewport={"width": 360, "height": 640}, device_scale_factor=1, is_mobile=True, has_touch=True)
            page = phone.new_page()
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.set_content(harness, wait_until="domcontentloaded", timeout=30000)
            page.locator('[data-action="go-new-game"]').wait_for(timeout=12000)
            record("Phone menu boots", page.locator('[data-action="go-new-game"]').is_visible())
            footer_text = page.locator('#build-footer').inner_text()
            record("Build metadata and final QA status visible", BUILD_INFO["version"] in footer_text and BUILD_INFO["date"] in footer_text and BUILD_INFO["time"] in footer_text and BUILD_INFO["qaStatus"] in footer_text, footer_text)
            record("Phone menu has no horizontal overflow", no_overflow(page))
            page.locator('[data-action="set-language"][data-lang="en"]').click()
            record("English localization works", page.evaluate("document.documentElement.lang") == "en")
            page.locator('[data-action="set-language"][data-lang="es"]').click()
            record("Spanish localization works", page.evaluate("document.documentElement.lang") == "es")
            page.locator('[data-action="set-language"][data-lang="pt-BR"]').click()
            create_commander(page, '<img src=x>Commander QA')
            record("Commander name is sanitized", page.locator('img[src="x"]').count() == 0)
            enter_gameplay(page)
            record("Phone gameplay has no horizontal overflow", no_overflow(page))
            primary = page.locator('#open-periscope').bounding_box()
            record("Primary combat control remains above fold", bool(primary) and primary["y"] + primary["height"] <= 640, str(primary))
            diag = page.evaluate("document.getElementById('app').__simulationEngine.diagnostics()")
            record("Simulation engine mounted", diag.get("engine") == "SimulationEngine", str(diag))
            record("Navigation, physics, sensors, weapons, naval AI and damage control mounted", diag.get("navigationVersion") == 2 and diag.get("physicsVersion") == 1 and diag.get("environmentVersion") == 1 and diag.get("sensorVersion") == 2 and diag.get("weaponVersion") == 1 and diag.get("aiVersion") == 2 and diag.get("damageControlVersion") == 1 and diag.get("encounterVersion") == 1, str(diag))
            page.locator('[data-station="instruments"]').click()
            record("Physics station is visible", page.locator('.physics-panel').is_visible())
            snapshot = page.evaluate("document.getElementById('app').__simulationEngine.snapshot()")
            record("Snapshot schema includes environment, physics, sensors, weapons, naval AI and damage control", snapshot.get("snapshotVersion") == 10 and snapshot.get("environment",{}).get("environmentVersion") == 1 and snapshot.get("physics",{}).get("physicsVersion") == 1 and snapshot.get("sensors",{}).get("sensorVersion") == 2 and snapshot.get("weapons",{}).get("weaponVersion") == 1 and snapshot.get("navalAI",{}).get("aiVersion") == 2 and snapshot.get("damageControl",{}).get("profile",{}).get("teamCount") == 3, str({"physics":snapshot.get("physics"),"sensors":snapshot.get("sensors"),"weapons":snapshot.get("weapons"),"navalAI":snapshot.get("navalAI")}))
            page.locator('[data-station="ai"]').click()
            record("Naval AI station is visible", page.locator('.naval-ai-panel').is_visible())
            page.locator('[data-station="damage"]').click()
            record("Damage-control station is visible", page.locator('.damage-control-panel').is_visible())
            damage_test = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.applyDamage(18,'engines','gameplay.hintDepthCharge','depthCharge');
              const before=e.snapshot().damageControl; const room=before.compartments.find(c=>c.flooding>0);
              const assigned=e.assignDamageControlTeam('dc-team-1',room.id,'pump');
              for(let i=0;i<30;i+=1)e.step(80); const after=e.snapshot().damageControl;
              ({assigned,roomId:room.id,beforeFlood:room.flooding,afterFlood:after.compartments.find(c=>c.id===room.id).flooding,damage:after});
            """)
            record("Depth-charge damage creates compartment flooding and casualties", damage_test["beforeFlood"] > 0 and damage_test["damage"]["hullIntegrity"] < 100, str(damage_test))
            record("Damage-control team assignment is functional", damage_test["assigned"]["ok"] and damage_test["afterFlood"] < damage_test["beforeFlood"], str(damage_test))
            damage_ui = page.evaluate("({flood:document.getElementById('damage-total-flooding').textContent,fit:document.getElementById('damage-crew-fit').textContent,cards:document.querySelectorAll('.damage-compartment-card').length,teams:document.querySelectorAll('.damage-team-card').length})")
            record("Damage-control instruments mirror engine state", damage_ui["flood"] != "0%" and damage_ui["cards"] == 7 and damage_ui["teams"] == 3, str(damage_ui))
            page.evaluate("document.getElementById('toast').style.display='none'")
            page.locator('.damage-control-panel').screenshot(path=str(SCREENSHOT_DIR / 'phase10_phone_damage.png'))
            page.evaluate("document.getElementById('toast').style.display=''")
            record("Mission contains a real multi-ship convoy", snapshot["navalAI"]["totalShips"] >= 4 and snapshot["navalAI"]["activeMerchants"] >= 3 and snapshot["navalAI"]["activeEscorts"] >= 1, str(snapshot["navalAI"]))
            page.locator('[data-station="ai"]').click()
            ai_ui = page.evaluate("({merchants:document.getElementById('ai-merchants-active').textContent,escorts:document.getElementById('ai-escorts-active').textContent,state:document.getElementById('ai-state-badge').textContent,markers:document.querySelectorAll('.ai-contact-marker').length})")
            record("AI instruments mirror convoy engine state", ai_ui["merchants"].startswith(str(snapshot["navalAI"]["activeMerchants"])) and ai_ui["escorts"].startswith(str(snapshot["navalAI"]["activeEscorts"])) and ai_ui["markers"] >= snapshot["navalAI"]["totalShips"], str(ai_ui))
            ai_hunt = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.session.detectionScore=90; e.navalAI.state.attackCooldownMs=0; e.navalAI.activeEscorts().forEach((ship,index)=>ship.moveTo(index*18,0));
              e.physics.restore({...e.snapshot().physics,depth:55,orderedDepth:55,verticalSpeed:0,noise:10}); e.player.setDepth(55,300);
              e.step(80); const immediate=e.snapshot(); for(let i=0;i<345;i+=1)e.step(80); const launched=e.snapshot(); for(let i=0;i<125;i+=1)e.step(80); const after=e.snapshot();
              ({immediate,launched,after});
            """)
            record("Coordinated escorts enter hunt without instant attack", ai_hunt["immediate"]["navalAI"]["globalState"] == "hunt" and len(ai_hunt["immediate"]["navalAI"]["depthChargePatterns"]) == 0, str(ai_hunt["immediate"]["navalAI"]))
            record("Coordinated escorts launch after a readable attack setup", len(ai_hunt["launched"]["navalAI"]["depthChargePatterns"]) >= 1, str(ai_hunt["launched"]["navalAI"]))
            record("Depth-charge attack resolves through engine damage or near miss", ai_hunt["after"]["navalAI"]["metrics"]["patternsDropped"] >= 1 and (ai_hunt["after"]["metrics"]["damageTaken"] > 0 or ai_hunt["after"]["navalAI"]["metrics"]["nearMisses"] > 0), str({"damage":ai_hunt["after"]["metrics"]["damageTaken"],"ai":ai_hunt["after"]["navalAI"]["metrics"]}))
            page.evaluate("document.getElementById('toast').style.display='none'")
            page.locator('.naval-ai-panel').screenshot(path=str(SCREENSHOT_DIR / 'phase10_phone_ai.png'))
            page.evaluate("document.getElementById('toast').style.display=''")
            page.locator('[data-station="instruments"]').click()
            live_snapshot = page.evaluate("document.getElementById('app').__simulationEngine.snapshot()")
            meter = page.evaluate("({depth:document.getElementById('physics-depth').textContent,battery:document.getElementById('physics-battery-value').textContent,oxygen:document.getElementById('physics-oxygen-value').textContent})")
            record("Depth, battery and oxygen meters read live state", str(round(live_snapshot["physics"]["depth"])) in meter["depth"] and str(round(live_snapshot["physics"]["battery"])) in meter["battery"] and str(round(live_snapshot["physics"]["oxygen"])) in meter["oxygen"], str(meter))

            progressive = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              const before=e.snapshot(); e.adjustDepth(60); const ordered=e.snapshot();
              for(let i=0;i<100;i+=1)e.step(80); const after=e.snapshot();
              ({before:before.depth,beforeOrder:before.physics.orderedDepth,immediate:ordered.depth,order:ordered.physics.orderedDepth,after:after.depth,vertical:after.physics.verticalSpeed});
            """)
            record("Depth changes progressively instead of teleporting", progressive["immediate"] == progressive["before"] and progressive["order"] == progressive["beforeOrder"] + 60 and progressive["after"] > progressive["before"], str(progressive))
            ballast = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; const before=e.snapshot().physics.ballast;
              e.setBallastCommand('flood'); for(let i=0;i<30;i+=1)e.step(80); const flooded=e.snapshot().physics;
              e.setBallastCommand('blow'); for(let i=0;i<30;i+=1)e.step(80); const blown=e.snapshot().physics;
              ({before,flooded:flooded.ballast,blown:blown.ballast,verticalFlood:flooded.verticalSpeed,verticalBlow:blown.verticalSpeed});
            """)
            record("Ballast controls change measured ballast and vertical motion", ballast["flooded"] > ballast["before"] and ballast["blown"] < ballast["flooded"] and ballast["verticalBlow"] < ballast["verticalFlood"], str(ballast))
            trim = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.nudgeTrim(3); const moved=e.snapshot().physics.trim; e.levelTrim();
              ({moved,level:e.snapshot().physics.trim,hold:e.snapshot().physics.depthHold});
            """)
            record("Trim meter responds and level command restores hold", trim["moved"] > 0 and trim["level"] == 0 and trim["hold"], str(trim))
            energy = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine;
              e.physics.restore({...e.snapshot().physics,depth:60,orderedDepth:60,battery:80,oxygen:80,co2:10}); e.player.setDepth(60,300);
              const before=e.snapshot().physics; e.physics.update(3600000,{telegraphSpeed:'full',systems:e.player.systems,timeCompression:1}); e.player.setDepth(e.physics.snapshot().depth,300); e.emitState();
              ({before,after:e.snapshot().physics});
            """)
            record("Submerged resource meters consume battery and atmosphere", energy["after"]["battery"] < energy["before"]["battery"] and energy["after"]["oxygen"] < energy["before"]["oxygen"] and energy["after"]["co2"] > energy["before"]["co2"], str(energy["after"]))
            page.evaluate("document.getElementById('toast').style.display='none'")
            page.locator('.physics-panel').screenshot(path=str(SCREENSHOT_DIR / 'phase10_phone_physics.png'))
            page.evaluate("document.getElementById('toast').style.display=''")

            page.locator('[data-station="sensors"]').click()
            record("Sensor station is visible", page.locator('.sensor-panel').is_visible())
            passive = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.physics.restore({...e.snapshot().physics,depth:60,orderedDepth:60,noise:2,cavitation:0}); e.player.setDepth(60,300);
              e.target.moveTo(0,-100); e.escort.moveTo(0,-180); e.sensors.state.hydrophoneBearing=0;
              e.sensors.observePassive(e.sensorContext()); e.emitState(); const s=e.snapshot();
              ({contact:s.sensors.contacts.target,count:s.sensors.visibleContactCount,mode:s.sensors.mode,radar:s.sensors.profile.radarAvailable,profile:s.sensors.profile});
            """)
            record("Passive hydrophone acquires an uncertain contact", passive["contact"]["detected"] and passive["contact"]["source"] == "hydrophone" and passive["contact"]["confidence"] > 0, str(passive))
            record("1939 German radar is correctly unavailable", passive["radar"] is False and page.locator('#radar-mast-toggle').is_disabled(), str(passive))
            ping = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.session.detectionScore=5; const before=e.snapshot().detectionScore;
              const result=e.activeSonarPing(); const after=e.snapshot();
              ({result,before,after:after.detectionScore,contact:after.sensors.contacts.target,cooldown:after.sensors.activePingCooldownMs});
            """)
            record("Active sonar provides range and raises detection risk", ping["result"]["ok"] and ping["contact"]["rangeKnown"] and ping["contact"]["source"] == "activeSonar" and ping["after"] > ping["before"] and ping["cooldown"] > 0, str(ping))
            sensor_ui = page.evaluate("({contacts:document.getElementById('sensor-contact-count').textContent,target:document.getElementById('sensor-target-range').textContent,source:document.getElementById('sensor-target-source').textContent})")
            record("Sensor instruments render engine contact state", int(sensor_ui["contacts"]) >= 1 and sensor_ui["target"] != "--" and sensor_ui["source"] != "--", str(sensor_ui))
            page.evaluate("document.getElementById('toast').style.display='none'")
            page.locator('.sensor-panel').screenshot(path=str(SCREENSHOT_DIR / 'phase10_phone_sensors.png'))
            page.evaluate("document.getElementById('toast').style.display=''")

            page.locator('[data-station="weapons"]').click()
            record("Torpedo room and TDC are visible", page.locator('.weapons-panel').is_visible())
            weapon_setup = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.physics.restore({...e.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0,battery:80,oxygen:80,co2:10}); e.player.setDepth(5,300);
              e.target.moveTo(100,0); e.escort.moveTo(320,40); e.session.view={x:100,y:0}; e.session.missionFailed=false; e.player.hull=100;
              e.player.systems={engines:100,sonar:100,periscope:100,weapons:100}; e.session.detectionScore=0; e.session.escortState='patrol'; e.escort.destroyed=false; e.escort.active=true; e.escort.setState('patrol');
              const opened=e.openPeriscope(); const synced=e.syncTdcSolution(); const s=e.snapshot();
              ({opened,synced,weapons:s.weapons});
            """)
            record("TDC builds a valid solution from sensor contact", weapon_setup["opened"]["ok"] and weapon_setup["synced"]["ok"] and weapon_setup["weapons"]["tdc"]["solutionQuality"] >= weapon_setup["weapons"]["minimumSolutionQuality"] and weapon_setup["weapons"]["canFire"], str(weapon_setup["weapons"]["tdc"]))
            weapon_ui = page.evaluate("({quality:document.getElementById('tdc-quality').textContent,bearing:document.getElementById('tdc-bearing').textContent,loaded:document.getElementById('weapons-loaded-count').textContent})")
            record("TDC instruments mirror engine values", weapon_ui["quality"] != "0%" and weapon_ui["bearing"] != "--" and int(weapon_ui["loaded"]) >= 1, str(weapon_ui))
            fired_salvo = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; const salvo=e.setSalvoSize(2); const before=e.snapshot().weapons;
              const fired=e.fireTorpedo(); const after=e.snapshot();
              ({salvo,fired,before,after:after.weapons,total:after.torpedoes});
            """)
            record("Two-torpedo salvo uses separate tubes", fired_salvo["fired"]["ok"] and fired_salvo["fired"]["salvoSize"] == 2 and len(fired_salvo["after"]["activeShots"]) == 2 and fired_salvo["after"]["loadedTubeCount"] == fired_salvo["before"]["loadedTubeCount"] - 2, str(fired_salvo))
            resolved_salvo = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; let guard=0;
              while(e.snapshot().torpedoActive && guard<400){e.step(80);guard+=1;} const s=e.snapshot();
              ({guard,weapons:s.weapons,targetDestroyed:s.targetDestroyed,shots:s.metrics.shots});
            """)
            record("Salvo resolves in deterministic simulated time", resolved_salvo["guard"] < 400 and len(resolved_salvo["weapons"]["activeShots"]) == 0 and resolved_salvo["shots"] == 2, str(resolved_salvo))
            page.evaluate("document.getElementById('app').__simulationEngine.closePeriscope()")

            # Navigation regression: one click must add exactly one waypoint.
            page.locator('[data-station="navigation"]').click()
            route_before = page.evaluate("document.getElementById('app').__simulationEngine.snapshot().navigation.route.length")
            page.evaluate("""
              const el=document.getElementById('navigation-map'); const r=el.getBoundingClientRect();
              el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+Math.min(210,r.width-4),clientY:r.top+Math.min(100,r.height-4)}));
            """)
            route_after = page.evaluate("document.getElementById('app').__simulationEngine.snapshot().navigation.route.length")
            record("Map click adds exactly one waypoint", route_after == route_before + 1, f"{route_before}->{route_after}")

            # Safe periscope and time-compression interlock.
            interlock = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine;
              e.physics.restore({...e.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0,battery:80,oxygen:80,co2:10}); e.player.setDepth(5,300);
              e.requestTimeCompression(16); const opened=e.openPeriscope(); e.step(80);
              ({opened,nav:e.snapshot().navigation});
            """)
            record("Periscope forces time compression to 1x", interlock["opened"]["ok"] and interlock["nav"]["timeCompression"] == 1 and interlock["nav"]["safetyLimited"], str(interlock))
            page.evaluate("document.getElementById('app').__simulationEngine.closePeriscope()")

            # Operation autosave must retain every physical gauge.
            before_leave = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.target.destroyed=false; e.target.active=true; e.session.canComplete=false; e.session.missionFailed=false;
              e.physics.restore({...e.snapshot().physics,depth:72,orderedDepth:105,verticalSpeed:0.8,battery:63,fuel:84,oxygen:77,co2:19,ballast:67,trim:4});
              e.player.setDepth(72,300); e.emitState(); e.snapshot();
            """)
            page.locator('[data-nav="briefing"]').click()
            record("Operation autosave is offered", page.locator('[data-action="resume-operation"]').is_visible())
            page.locator('[data-action="resume-operation"]').click(); page.locator('.gameplay-screen').wait_for(timeout=8000)
            restored = page.evaluate("document.getElementById('app').__simulationEngine.snapshot()")
            rp = restored["physics"]
            record("Operation autosave restores all critical gauges", abs(restored["depth"]-72) < .2 and abs(rp["orderedDepth"]-105) < .01 and abs(rp["battery"]-63) < .02 and abs(rp["fuel"]-84) < .02 and abs(rp["oxygen"]-77) < .02 and abs(rp["co2"]-19) < .02 and abs(rp["ballast"]-67) < 1.1 and abs(rp["trim"]-4) < .4, str(rp))
            record("Operation autosave preserves navigation", abs(restored["navigation"]["position"]["lat"] - before_leave["navigation"]["position"]["lat"]) < .0001 and abs(restored["navigation"]["position"]["lon"] - before_leave["navigation"]["position"]["lon"]) < .0001, str(restored["navigation"]["position"]))
            record("Operation autosave preserves sensor tracks", restored["sensors"]["sensorVersion"] == 2 and abs(restored["sensors"]["contacts"]["target"]["confidence"] - before_leave["sensors"]["contacts"]["target"]["confidence"]) < 2, str(restored["sensors"]["contacts"]["target"]))
            record("Operation autosave preserves TDC and tube state", restored["weapons"]["weaponVersion"] == 1 and restored["weapons"]["totalTorpedoes"] == before_leave["weapons"]["totalTorpedoes"] and restored["weapons"]["salvoSize"] == before_leave["weapons"]["salvoSize"], str(restored["weapons"]))
            record("Operation autosave preserves convoy and ASW state", restored["navalAI"]["aiVersion"] == 2 and restored["navalAI"]["totalShips"] == before_leave["navalAI"]["totalShips"] and restored["navalAI"]["globalState"] == before_leave["navalAI"]["globalState"], str(restored["navalAI"]))
            record("Operation autosave preserves damage-control state", restored["damageControl"]["damageControlVersion"] >= 1 and len(restored["damageControl"]["teams"]) == len(before_leave["damageControl"]["teams"]) and abs(restored["damageControl"]["totalFlooding"] - before_leave["damageControl"]["totalFlooding"]) < 0.2 and restored["damageControl"]["casualtyTotals"] == before_leave["damageControl"]["casualtyTotals"], str(restored["damageControl"]))

            # Deterministic torpedo still works after sensor and TDC integration.
            combat = page.evaluate("""
              const e=document.getElementById('app').__simulationEngine; e.stop();
              e.physics.restore({...e.snapshot().physics,depth:5,orderedDepth:5,verticalSpeed:0,battery:80,oxygen:80,co2:10}); e.player.setDepth(5,300);
              e.target.moveTo(100,0); e.escort.moveTo(320,40); e.escort.destroyed=false; e.escort.active=true; e.escort.setState('patrol'); e.player.hull=100; e.player.systems={engines:100,sonar:100,periscope:100,weapons:100}; e.session.missionFailed=false; e.session.view={x:100,y:0}; e.session.detectionScore=0; e.session.metrics={shots:0,hits:0,maxDetection:0,damageTaken:0,startHull:100}; e.session.canComplete=false; e.session.torpedoActive=false; e.session.torpedoTravelTicks=0; e.session.escortState='patrol';
              e.setSalvoSize(1); const pre=e.snapshot(); e.moveView(pre.target.x-pre.view.x, pre.target.y-pre.view.y); const opened=e.openPeriscope(); const synced=e.syncTdcSolution(); const fired=e.fireTorpedo();
              for(let i=0;i<300 && e.snapshot().torpedoActive;i+=1)e.clock.stepOnce();
              ({opened,synced,fired,snapshot:e.snapshot(),report:e.missionReport()});
            """)
            record("Combat remains deterministic and requires safe disengagement", combat["opened"]["ok"] and combat["synced"]["ok"] and combat["fired"]["ok"] and combat["snapshot"]["targetDestroyed"] and not combat["snapshot"]["canComplete"] and combat["snapshot"]["encounter"]["phase"] == "evade" and combat["report"] is None, str(combat))
            phone.close()

            tiny = browser.new_context(viewport={"width": 320, "height": 568}, device_scale_factor=1, is_mobile=True, has_touch=True)
            tiny_page = tiny.new_page(); tiny_page.set_content(harness, wait_until="domcontentloaded", timeout=30000); tiny_page.locator('[data-action="go-new-game"]').wait_for(timeout=10000)
            create_commander(tiny_page); enter_gameplay(tiny_page)
            record("320x568 gameplay has no horizontal overflow", no_overflow(tiny_page))
            tiny_primary = tiny_page.locator('#open-periscope').bounding_box()
            record("320x568 combat control remains reachable", bool(tiny_primary) and tiny_primary["y"] + tiny_primary["height"] <= 568, str(tiny_primary))
            tiny.close(); browser.close()
    except Exception as exc:
        record("Smoke execution", False, repr(exc))

    harmless = ["Failed to load resource", "Not allowed to load local resource"]
    harmful = [item for item in errors if not any(fragment in item for fragment in harmless)]
    record("No uncaught browser errors", not harmful, " | ".join(harmful[:10]))
    passed = sum(item["status"] == "PASS" for item in checks)
    failed = sum(item["status"] == "FAIL" for item in checks)
    result = {"summary": {"passed": passed, "failed": failed}, "consoleErrors": errors, "checks": checks}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SMOKE {'PASS' if failed == 0 else 'FAIL'}: {passed} passed, {failed} failed")
    for item in checks:
        print(f"[{item['status']}] {item['name']} {item['details']}", flush=True)
    os._exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    raise SystemExit(main())
