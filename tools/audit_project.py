#!/usr/bin/env python3
"""Deterministic anti-break audit for Submarine Commander WW2 — Phase 10."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_JSON = ROOT / 'reports' / 'phase10_audit.json'
REPORT_MD = ROOT / 'reports' / 'PHASE_10_AUDIT.md'
checks: list[dict[str, str]] = []


def check(name: str, condition: bool, details: object = '') -> None:
    checks.append({'name': name, 'status': 'PASS' if condition else 'FAIL', 'details': str(details)})


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        check(f'JSON válido: {path.relative_to(ROOT)}', False, exc)
        return None


def run(command: list[str]) -> tuple[bool, str]:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    output = (result.stdout + '\n' + result.stderr).strip()
    return result.returncode == 0, output[-10000:]


def unique_ids(label: str, items) -> set[str]:
    ids = [item.get('id') for item in items if isinstance(item, dict)] if isinstance(items, list) else []
    valid = bool(ids) and all(isinstance(value, str) and value for value in ids) and len(ids) == len(set(ids))
    check(f'IDs únicos: {label}', valid, f'quantidade={len(ids)}')
    return set(ids)


def has_all(source: str, tokens: list[str]) -> bool:
    return all(token in source for token in tokens)


def main() -> int:
    required = [
        'index.html', 'manifest.json', 'BUILD_INFO.json', 'service-worker.js', 'package.json',
        'ANTI_BREAK_PROTOCOL.md', 'CHANGELOG.md', 'README.md',
        'css/phase2-responsive.css', 'css/phase3-engine.css', 'css/phase4-save.css',
        'css/phase5-navigation.css', 'css/phase6-physics.css', 'css/phase7-sensors.css', 'css/phase8-weapons.css', 'css/phase9-ai.css', 'css/phase10-damage.css',
        'js/app.js', 'js/build.js', 'js/save.js', 'js/state.js', 'js/safety.js',
        'js/screens/mainMenu.js', 'js/screens/profiles.js', 'js/screens/briefing.js', 'js/screens/gameplay.js',
        'js/engine/core/EventBus.js', 'js/engine/core/SimulationClock.js',
        'js/engine/navigation/NavigationSystem.js', 'js/engine/physics/SubmarinePhysicsSystem.js', 'js/engine/sensors/SensorSystem.js', 'js/engine/weapons/WeaponSystem.js', 'js/engine/ai/NavalAISystem.js', 'js/engine/damage/DamageControlSystem.js',
        'js/engine/simulation/SimulationEngine.js', 'js/engine/scenes/SceneManager.js',
        'tests/engine.test.js', 'tests/save.test.js', 'tests/navigation.test.js', 'tests/physics.test.js', 'tests/sensors.test.js', 'tests/weapons.test.js', 'tests/naval_ai.test.js', 'tests/damage_control.test.js', 'tests/smoke_test.py',
        'docs/SAVE_ARCHITECTURE_V3.md', 'docs/NAVIGATION_ARCHITECTURE_V1.md', 'docs/PHYSICS_ARCHITECTURE_V1.md', 'docs/SENSOR_ARCHITECTURE_V1.md', 'docs/WEAPON_ARCHITECTURE_V1.md', 'docs/NAVAL_AI_ARCHITECTURE_V1.md', 'docs/DAMAGE_CONTROL_ARCHITECTURE_V1.md',
        'RELEASE_NOTES_v2.0.0-alpha.09.md', 'PHASE_9_DELIVERY_REPORT.md',
        'QA_CHECKLIST_PHASE_9.md', 'KNOWN_ISSUES_PHASE_9.md', 'ROLLBACK_PHASE_9.md',
        'RELEASE_NOTES_v2.0.0-alpha.10.md', 'PHASE_10_DELIVERY_REPORT.md',
        'QA_CHECKLIST_PHASE_10.md', 'KNOWN_ISSUES_PHASE_10.md', 'ROLLBACK_PHASE_10.md',
        'data/nations.json', 'data/submarines.json', 'data/crew.json', 'data/missions.json', 'data/upgrades.json',
        'data/translations/pt-BR.json', 'data/translations/en.json', 'data/translations/es.json',
    ]
    for relative in required:
        path = ROOT / relative
        check(f'Arquivo obrigatório: {relative}', path.is_file() and path.stat().st_size > 0, f'bytes={path.stat().st_size if path.exists() else 0}')

    forbidden = ['admin', 'js/admin.js', 'js/store.js', 'css/style.css', 'content/online-library', 'tests/smoke_test_phase5_archive.py']
    present = [path for path in forbidden if (ROOT / path).exists()]
    check('Resíduos de outros projetos e arquivo de teste obsoleto removidos', not present, f'presentes={present}')

    json_fail_before = sum(item['status'] == 'FAIL' for item in checks)
    for path in sorted(ROOT.rglob('*.json')):
        if path.name == 'PACKAGE_MANIFEST.json':
            continue
        load_json(path)
    json_fail_after = sum(item['status'] == 'FAIL' for item in checks)
    check('Todos os JSON do projeto são válidos', json_fail_before == json_fail_after)

    build = load_json(ROOT / 'BUILD_INFO.json') or {}
    manifest = load_json(ROOT / 'manifest.json') or {}
    package = load_json(ROOT / 'package.json') or {}
    index = read('index.html')
    build_js = read('js/build.js')
    sw = read('service-worker.js')
    app = read('js/app.js')
    save_js = read('js/save.js')
    gameplay = read('js/screens/gameplay.js')
    engine = read('js/engine/simulation/SimulationEngine.js')
    navigation = read('js/engine/navigation/NavigationSystem.js')
    physics = read('js/engine/physics/SubmarinePhysicsSystem.js')
    physics_css = read('css/phase6-physics.css')
    sensors = read('js/engine/sensors/SensorSystem.js')
    sensor_css = read('css/phase7-sensors.css')
    weapons = read('js/engine/weapons/WeaponSystem.js')
    weapon_css = read('css/phase8-weapons.css')
    naval_ai = read('js/engine/ai/NavalAISystem.js')
    ai_css = read('css/phase9-ai.css')
    damage = read('js/engine/damage/DamageControlSystem.js')
    damage_css = read('css/phase10-damage.css')
    data_loader = read('js/dataLoader.js')

    check('Metadados identificam a Fase 10.4', str(build.get('phase')) == '10.4' and build.get('version') == 'v2.0.0-alpha.10.4', {'phase': build.get('phase'), 'version': build.get('version')})
    check('Semver correto', build.get('semver') == '2.0.0-alpha.10.4')
    check('Build ID da Fase 10.4', str(build.get('buildId', '')).startswith('SCWW2-20260617-'))
    check('Data e hora da build presentes', build.get('date') == '2026-06-17' and bool(re.fullmatch(r'\d{2}:\d{2}', str(build.get('time', '')))))
    check('Timezone oficial preservado', build.get('timezone') == 'America/Sao_Paulo')
    check('Canal alpha sem falso lançamento comercial', build.get('channel') == 'alpha' and build.get('release') is False)
    check('Status QA permitido no portão', build.get('qaStatus') in {'PENDING', 'PASS'})
    check('Schema de save permanece v3', build.get('saveSchemaVersion') == 3)
    check('Versão centralizada no JS gerado', build.get('version') in build_js and build.get('buildId') in build_js)
    check('Versão visível no título e descrição', build.get('version') in index and 'fase 10' in index.lower())
    check('Manifesto PWA acompanha versão', manifest.get('version') == build.get('semver') and build.get('version') in manifest.get('name', ''))
    check('Package acompanha versão e ESM', package.get('version') == build.get('semver') and package.get('type') == 'module')
    check('Scripts unitários de sensores, armas, IA e avarias registrados', package.get('scripts', {}).get('test:sensors') == 'node --test tests/sensors.test.js' and package.get('scripts', {}).get('test:weapons') == 'node --test tests/weapons.test.js' and package.get('scripts', {}).get('test:ai') == 'node --test tests/naval_ai.test.js' and package.get('scripts', {}).get('test:damage') == 'node --test tests/damage_control.test.js')
    check('Suite geral inclui física, sensores, armas, IA naval e avarias', all(item in package.get('scripts', {}).get('test', '') for item in ('tests/physics.test.js', 'tests/sensors.test.js', 'tests/weapons.test.js', 'tests/naval_ai.test.js', 'tests/damage_control.test.js')))
    check('Cache PWA acompanha versão', f"const CACHE_VERSION = '{build.get('semver')}';" in sw)
    check('CSS das Fases 7 a 10 carregados pelo HTML', all(item in index for item in ('css/phase7-sensors.css', 'css/phase8-weapons.css', 'css/phase9-ai.css', 'css/phase10-damage.css'))) 

    translations = {lang: load_json(ROOT / 'data/translations' / f'{lang}.json') or {} for lang in ('pt-BR', 'en', 'es')}
    keysets = {lang: set(data.keys()) for lang, data in translations.items()}
    check('Paridade de chaves PT-BR/EN/ES', len({frozenset(keys) for keys in keysets.values()}) == 1, {lang: len(keys) for lang, keys in keysets.items()})
    check('Quantidade robusta de traduções', all(len(keys) >= 700 for keys in keysets.values()), {lang: len(keys) for lang, keys in keysets.items()})
    physics_keys = {
        'physics.station', 'physics.actualDepth', 'physics.orderedDepth', 'physics.verticalSpeed',
        'physics.actualSpeed', 'physics.ballast', 'physics.trim', 'physics.pressure', 'physics.propulsion',
        'physics.fuel', 'physics.battery', 'physics.oxygen', 'physics.co2', 'physics.noise', 'physics.cavitation',
        'physics.ballastMode.auto', 'physics.ballastMode.blow', 'physics.ballastMode.neutral', 'physics.ballastMode.flood',
        'physics.statusNormal', 'physics.statusWarning', 'physics.statusCritical', 'physics.interlockReady',
        'physics.flag.pressure', 'physics.flag.battery', 'physics.flag.fuel', 'physics.flag.oxygen',
        'physics.flag.co2', 'physics.flag.cavitation', 'physics.emergencyBlow', 'physics.level'
    }
    check('Todas as strings de física existem nos três idiomas', all(physics_keys.issubset(keys) for keys in keysets.values()), f'chaves={len(physics_keys)}')
    for lang, data in translations.items():
        blank = [key for key in physics_keys if not str(data.get(key, '')).strip()]
        check(f'Textos de física não vazios: {lang}', not blank, f'vazios={blank}')

    sensor_keys = {
        'sensors.station', 'sensors.modeHydrophone', 'sensors.modeRadar', 'sensors.activePing',
        'sensors.raiseRadarMast', 'sensors.lowerRadarMast', 'sensors.contacts', 'sensors.contactCount', 'sensors.classification',
        'sensors.bearing', 'sensors.range', 'sensors.source', 'sensors.sonarIntegrity',
        'sensors.targetContact', 'sensors.escortContact', 'sensors.classUnknown',
        'sensors.source.hydrophone', 'sensors.source.activeSonar', 'sensors.source.radar',
        'sensors.source.periscope', 'sensors.activePingSent', 'sensors.radarEraUnavailable',
        'sensors.visualContact', 'sensors.visualAwaiting', 'sensors.hintActivePing'
    }
    check('Todas as strings de sensores existem nos três idiomas', all(sensor_keys.issubset(keys) for keys in keysets.values()), f'chaves={len(sensor_keys)}')
    for lang, data in translations.items():
        blank = [key for key in sensor_keys if not str(data.get(key, '')).strip()]
        check(f'Textos de sensores não vazios: {lang}', not blank, f'vazios={blank}')

    nations = load_json(ROOT / 'data/nations.json') or []
    submarines = load_json(ROOT / 'data/submarines.json') or []
    crew = load_json(ROOT / 'data/crew.json') or []
    missions = load_json(ROOT / 'data/missions.json') or []
    upgrades = load_json(ROOT / 'data/upgrades.json') or []
    nation_ids = unique_ids('nações', nations)
    submarine_ids = unique_ids('submarinos', submarines)
    unique_ids('tripulação', crew)
    unique_ids('missões', missions)
    unique_ids('upgrades', upgrades)
    check('Submarino inicial de cada nação existe', all(n.get('starterSubmarineId') in submarine_ids for n in nations))
    check('Referências de nação dos submarinos são válidas', all(s.get('nation') in nation_ids for s in submarines))
    check('Referências de nação da tripulação são válidas', all(c.get('nation') in nation_ids for c in crew))
    check('Todos os submarinos possuem estatísticas para física', all(all(isinstance((s.get('stats') or {}).get(key), (int, float)) for key in ('speed', 'range', 'stealth', 'depth')) for s in submarines), f'quantidade={len(submarines)}')
    check('Atributos de profundidade estão em faixa válida', all(1 <= (s.get('stats') or {}).get('depth', 0) <= 100 for s in submarines))

    def valid_navigation(mission: dict) -> bool:
        nav = mission.get('navigation') or {}
        bounds = nav.get('mapBounds') or {}
        route = nav.get('route') or []
        sector = nav.get('patrolSector') or {}
        return (
            all(isinstance(bounds.get(k), (int, float)) for k in ('north', 'south', 'west', 'east'))
            and bounds.get('north') > bounds.get('south') and bounds.get('east') > bounds.get('west')
            and isinstance(route, list) and 1 <= len(route) <= 8
            and all(isinstance(p.get('lat'), (int, float)) and isinstance(p.get('lon'), (int, float)) for p in route)
            and all(isinstance(sector.get(k), (int, float)) for k in ('north', 'south', 'west', 'east'))
        )
    check('Planos de navegação das missões continuam válidos', all(valid_navigation(m) for m in missions), f'missões={len(missions)}')
    check('Validador de navegação permanece ativo', 'validateMissionNavigation' in data_loader and 'route must contain 1 to 8 waypoints' in data_loader)

    shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw, re.S)
    shell_assets = re.findall(r"'([^']+)'", shell_match.group(1)) if shell_match else []
    shell_missing = []
    for asset in shell_assets:
        clean = asset.removeprefix('./')
        if clean in {'', '.'}:
            continue
        if not (ROOT / clean).is_file():
            shell_missing.append(asset)
    check('Todos os arquivos do app shell existem', not shell_missing, f'ausentes={shell_missing}')
    check('Módulos de física e sensores disponíveis offline', all(item in shell_assets for item in ('./js/engine/physics/SubmarinePhysicsSystem.js', './js/engine/sensors/SensorSystem.js')))
    check('CSS de física e sensores disponíveis offline', all(item in shell_assets for item in ('./css/phase6-physics.css', './css/phase7-sensors.css')))
    check('Motor, navegação e save continuam offline', all(item in shell_assets for item in ('./js/engine/simulation/SimulationEngine.js', './js/engine/navigation/NavigationSystem.js', './js/save.js')))
    check('Instalação falha se app shell estiver incompleto', 'App shell incomplete' in sw)
    check('Fallback HTML restrito a navegação', "request.mode === 'navigate'" in sw and "catch(() => caches.match('./index.html'))" not in sw)
    check('Cache limpa somente versões do próprio jogo', 'key.startsWith(CACHE_PREFIX)' in sw)
    check('JSON usa estratégia network-first sem HTML', "url.pathname.endsWith('.json')" in sw and 'networkFirst(request)' in sw)

    physics_tokens = [
        'export class SubmarinePhysicsSystem', 'setOrderedDepth', 'adjustOrderedDepth', 'setBallastCommand',
        'setTrim', 'nudgeTrim', 'levelTrim', 'emergencyDive', 'emergencyBlow', 'recalculateDerived',
        'actualSpeedKnots', 'pressurePercent', 'hullStress', 'fuel', 'battery', 'oxygen', 'co2',
        'noise', 'cavitation', 'drainDamageEvents', 'physicsVersion: 1'
    ]
    for token in physics_tokens:
        check(f'Contrato de física contém: {token}', token in physics)
    check('Profundidade ordenada separada da real', 'orderedDepth' in physics and 'this.state.depth =' in physics and 'this.state.orderedDepth =' in physics)
    check('Mergulho usa convergência e não teleporte', 'approach(this.state.verticalSpeed' in physics and 'this.state.depth = clamp(this.state.depth + this.state.verticalSpeed * dt' in physics)
    check('Lastro automático considera erro e velocidade vertical', 'depthError * 0.55' in physics and 'this.state.verticalSpeed * 5' in physics)
    check('Trimagem participa da força vertical', 'const trimForce = this.state.trim / 15' in physics)
    check('Propulsão alterna diesel/elétrica por profundidade', "submerged ? 'electric' : 'diesel'" in physics)
    check('Energia reduz velocidade real', 'energyFactor' in physics and 'targetSpeed = commanded' in physics and 'propulsionEfficiency' in physics)
    check('Recursos usam tempo simulado', 'simulatedMs / 3600000' in physics)
    check('Bateria e atmosfera são consumidas submersas', 'this.state.battery = clamp(this.state.battery -' in physics and 'this.state.oxygen = clamp(this.state.oxygen -' in physics and 'this.state.co2 = clamp(this.state.co2 +' in physics)
    check('Superfície consome combustível e recarrega', 'this.state.fuel = clamp(this.state.fuel -' in physics and 'this.state.battery = clamp(this.state.battery +' in physics)
    check('Cavitação depende de pouca profundidade e velocidade', 'shallowCavitation' in physics and 'speedCavitation' in physics)
    check('Pressão acima do limite gera dano', 'this.state.depth > this.config.maxOperationalDepth' in physics and "reason: 'pressure'" in physics)
    check('Atmosfera crítica gera dano', "reason: 'atmosphere'" in physics)
    check('Restauração limita valores físicos', "const safe = (key, fallback, min, max)" in physics and "safe('battery'" in physics)

    engine_tokens = [
        "import { SubmarinePhysicsSystem }", 'this.physics = new SubmarinePhysicsSystem',
        'this.physics.update(stepMs', 'this.physics.drainDamageEvents()', 'this.physics.snapshot().actualSpeedKnots',
        'physics: this.physics.snapshot()', 'sensors: this.sensors.snapshot()', 'snapshotVersion: 10', 'setBallastCommand(mode)',
        'nudgeTrim(delta)', 'levelTrim()', 'emergencyBlow()'
    ]
    for token in engine_tokens:
        check(f'Integração do motor contém: {token}', token in engine)
    check('Navegação recebe velocidade física real', 'this.navigation.update(stepMs, this.player.speed, this.navigationSafetyLimit(), this.physics.snapshot().actualSpeedKnots)' in engine)
    check('Risco físico limita compressão de tempo', has_all(engine, ["physics.status === 'critical'", 'physics.pressurePercent', 'physics.oxygen', 'physics.co2', 'physics.cavitation']))
    check('Diagnóstico expõe física, sensores, armas, IA, avarias e versão do motor', all(token in engine for token in ('physicsVersion: 1', 'sensorVersion: 2', 'weaponVersion: 1', 'aiVersion: 2', 'damageControlVersion: 1', 'version: 10'))) 
    check('Correção de waypoint duplicado aplicada', navigation.count('this.route.push(waypoint)') == 1, f'ocorrências={navigation.count("this.route.push(waypoint)")}')

    meter_ids = [
        'physics-depth', 'physics-ordered-depth', 'physics-vertical-speed', 'physics-actual-speed',
        'physics-ballast', 'physics-trim', 'physics-pressure', 'physics-propulsion',
        'physics-fuel-value', 'physics-battery-value', 'physics-oxygen-value', 'physics-co2-value',
        'physics-noise-value', 'physics-cavitation-value', 'physics-fuel-bar', 'physics-battery-bar',
        'physics-oxygen-bar', 'physics-co2-bar', 'physics-noise-bar', 'physics-cavitation-bar'
    ]
    for meter_id in meter_ids:
        check(f'Medidor presente na interface: {meter_id}', f'id="{meter_id}"' in gameplay or f"querySelector('#{meter_id}')" in gameplay)
    check('Função de atualização física lê snapshot real', 'function updatePhysics(snapshot)' in gameplay and 'const physics = snapshot.physics' in gameplay)
    check('Todos os recursos usam a função de medidor', all(f'setMeter(els.{name}' in gameplay for name in ('physicsFuelValue', 'physicsBatteryValue', 'physicsOxygenValue', 'physicsCo2Value', 'physicsNoiseValue', 'physicsCavitationValue')))
    check('Barras recebem largura e estado visual', 'barElement.style.width' in gameplay and 'barElement.dataset.state' in gameplay)
    check('Ponteiro de profundidade usa profundidade real', 'depthToAngle(actualDepth, 300)' in gameplay)
    check('Marcador de ordem usa profundidade ordenada', 'depthToAngle(orderedDepth, 300)' in gameplay)
    check('HUD de bateria e oxigênio usa física', 'snapshot.physics?.battery' in gameplay and 'snapshot.physics?.oxygen' in gameplay)
    check('Interface atualiza em tick e mudança de estado', "engine.on('simulation:tick', updateAll)" in gameplay and "engine.on('state:changed', updateAll)" in gameplay)
    check('Controles de lastro conectados ao motor', 'engine.setBallastCommand(button.dataset.ballast)' in gameplay)
    check('Controles de trimagem conectados ao motor', 'engine.nudgeTrim(Number(button.dataset.trim))' in gameplay and 'engine.levelTrim()' in gameplay)
    check('Subida de emergência conectada ao motor', 'engine.emergencyBlow()' in gameplay)
    check('Autosave recebe snapshot físico', 'persistOperation(snapshot)' in gameplay and 'physics: this.physics.snapshot()' in engine)

    css_tokens = [
        '.physics-panel', '.physics-readout-grid', '.physics-meter-grid', '.physics-control-grid',
        '.physics-status.warning', '.physics-status.critical', 'em[data-state="warning"]', 'em[data-state="critical"]',
        '@media (min-width: 620px)', '@media (min-width: 980px)', '@media (max-width: 380px)',
        '@media (prefers-reduced-motion: reduce)', '@media (orientation: landscape) and (max-height: 540px)'
    ]
    for token in css_tokens:
        check(f'CSS responsivo contém: {token}', token in physics_css)
    check('Console físico ocupa área própria no grid', '.physics-panel { grid-area: physics; }' in physics_css and '"physics physics physics"' in physics_css)
    check('Controles prioritários continuam antes da física no mobile', re.search(r'grid-template-areas:\s*"action"\s*"mission"\s*"instruments"\s*"physics"', physics_css) is not None)
    check('KPIs duplicados são ocultos em telefones', '@media (max-width: 619px)' in physics_css and '.gameplay-kpis .physics-kpi' in physics_css)

    sensor_tokens = [
        'export class SensorSystem', 'setMode(mode)', 'nudgeHydrophoneBearing(delta)',
        'toggleRadarMast(force = null, depth = 0)', 'activePing(context = {})',
        'observeVisual(context = {})', 'observeActive(context = {})', 'observePassive(context = {})',
        'activePingCooldownMs', 'radarMastRaised', 'bearingUncertainty', 'rangeUncertainty',
        'confidence', 'classification', 'source', 'stale', 'drainExposureEvents()', 'sensorVersion: 2'
    ]
    for token in sensor_tokens:
        check(f'Contrato de sensores contém: {token}', token in sensors)
    check('Hidrofone sofre interferência de ruído e cavitação', all(token in sensors for token in ('ownNoise', 'cavitation', 'effectiveRange')))
    check('Sonar ativo gera exposição e possui recarga', "type: 'activePing'" in sensors and 'detectionBoost: 26' in sensors and 'ACTIVE_PING_COOLDOWN_MS' in sensors)
    check('Radar respeita disponibilidade histórica', 'radarIntroduction' in sensors and 'radarAvailable' in sensors and 'radarEraUnavailable' in sensors)
    check('Mastro de radar respeita profundidade', 'radarMastMaxDepth' in sensors and 'radarTooDeep' in sensors and 'radarMastRaised = false' in sensors)
    check('Contato visual exige periscópio e profundidade segura', 'context.periscopeOpen' in sensors and 'PERISCOPE_MAX_DEPTH' in sensors)
    check('Soluções envelhecem gradualmente', 'contact.ageMs += elapsed' in sensors and 'contact.confidence = clamp(contact.confidence - elapsed / decayDivisor' in sensors and 'contact.stale = true' in sensors)
    check('Restauração de sensores limita valores', 'clamp(snapshot.activePingCooldownMs' in sensors and 'clamp(incoming.confidence' in sensors)

    sensor_engine_tokens = [
        "import { SensorSystem }", 'this.sensors = new SensorSystem', 'this.sensors.update(stepMs',
        'this.sensors.drainExposureEvents()', 'this.sensors.observeVisual(this.sensorContext())',
        'setSensorMode(mode)', 'nudgeHydrophoneBearing(delta)', 'toggleRadarMast(force = null)', 'activeSonarPing()',
        'sensors: this.sensors.snapshot()', 'sensorVersion: 2'
    ]
    for token in sensor_engine_tokens:
        check(f'Integração de sensores no motor contém: {token}', token in engine)
    check('Ping ativo aumenta detecção do submarino', 'exposure.detectionBoost' in engine and 'this.session.detectionScore = clamp' in engine)
    check('Trava de torpedo exige solução visual', 'sensorReady' in engine and 'contact?.confidence' in engine and 'snapshot.periscopeOpen' in engine)

    sensor_ids = [
        'sensor-mode-badge', 'sensor-bearing', 'sensor-passive-range', 'sensor-radar-range',
        'sensor-integrity', 'sensor-contact-count', 'active-sonar-ping', 'radar-mast-toggle',
        'sensor-target-confidence', 'sensor-target-bearing', 'sensor-target-range', 'sensor-target-source',
        'sensor-escort-confidence', 'sensor-escort-bearing', 'sensor-escort-range', 'sensor-escort-source',
        'periscope-sensor-readout'
    ]
    for sensor_id in sensor_ids:
        check(f'Instrumento de sensores presente: {sensor_id}', f'id="{sensor_id}"' in gameplay or f"querySelector('#{sensor_id}')" in gameplay)
    check('Interface de sensores lê snapshot real', 'function updateSensors(snapshot)' in gameplay and 'const sensors = snapshot.sensors' in gameplay)
    check('Controles de sensores chamam o motor', all(token in gameplay for token in ('engine.setSensorMode', 'engine.nudgeHydrophoneBearing', 'engine.activeSonarPing', 'engine.toggleRadarMast')))
    check('Confiança dos contatos controla barras reais', 'confidenceBar.style.width' in gameplay and 'contact.confidence' in gameplay)
    check('Periscópio mostra solução do sensor', 'periscopeSensorReadout' in gameplay and 'sensors.visualAwaiting' in gameplay)

    sensor_css_tokens = [
        '.sensor-panel', '.sensor-layout', '.sensor-scope', '.sensor-contact-card',
        '.sensor-contact-card.detected', '.sensor-contact-card.stale', '.active-ping-wave',
        '@media (min-width:620px)', '@media (min-width:1024px)', '@media (max-width:380px)',
        '@media (orientation:landscape) and (max-height:540px)', '@media (prefers-reduced-motion:reduce)'
    ]
    for token in sensor_css_tokens:
        check(f'CSS de sensores responsivo contém: {token}', token in sensor_css)
    check('KPI de sensor é ocultado em telefone para preservar comandos', '.gameplay-kpis .sensor-kpi' in sensor_css and '@media (max-width: 619px)' in sensor_css)

    weapon_keys = {
        'weapons.station', 'weapons.tubeBank', 'weapons.loadedTubes', 'weapons.reserve',
        'weapons.failureRate', 'weapons.maxDepth', 'weapons.tdc', 'weapons.bearing',
        'weapons.range', 'weapons.gyro', 'weapons.contactConfidence', 'weapons.targetSpeed',
        'weapons.targetCourse', 'weapons.aob', 'weapons.runDepth', 'weapons.torpedoType',
        'weapons.typeSteam', 'weapons.typeElectric', 'weapons.salvo', 'weapons.syncSolution',
        'weapons.fireSolution', 'weapons.statusNoContact', 'weapons.statusPoor',
        'weapons.statusMarginal', 'weapons.statusGood', 'weapons.statusExcellent',
        'weapons.outcome.hit', 'weapons.outcome.miss', 'weapons.outcome.dud',
        'weapons.outcome.depthKeeping', 'weapons.outcome.premature', 'weapons.tooDeep',
        'weapons.tubeArc', 'weapons.tubesReloading', 'weapons.solutionPoor'
    }
    check('Todas as strings de armas existem nos três idiomas', all(weapon_keys.issubset(keys) for keys in keysets.values()), f'chaves={len(weapon_keys)}')
    for lang, data in translations.items():
        blank = [key for key in weapon_keys if not str(data.get(key, '')).strip()]
        check(f'Textos de armas não vazios: {lang}', not blank, f'vazios={blank}')

    weapon_tokens = [
        'export class WeaponSystem', 'setTarget(role)', 'selectTube(id)', 'setSalvoSize(value)',
        'setTorpedoType(type)', 'setTdcValue(key, value)', 'syncFromContact(context = {})',
        'tubeArcAllows(tube, relativeBearing)', 'fireCheck(context = {})', 'chooseTubes(validTubes)',
        'beginReload(tube, weaponsHealth = 100)', 'buildShot(tube, context = {})',
        'drainResolutionEvents()', 'drainExposureEvents()', 'weaponVersion: 1'
    ]
    for token in weapon_tokens:
        check(f'Contrato de armas contém: {token}', token in weapons)
    check('Perfis de torpedo a vapor e elétrico possuem parâmetros próprios', all(token in weapons for token in ("steam: Object.freeze", "electric: Object.freeze", 'speedKnots', 'maxRangeMeters', 'exposure')))
    check('Falhas históricas variam por nação e ano', 'historicalFailureRate(nation, year)' in weapons and "nation === 'us'" in weapons and "nation === 'de'" in weapons)
    check('Resolução de falhas inclui espoleta, profundidade e prematura', all(token in weapons for token in ("'dud'", "'depthKeeping'", "'premature'")))
    check('Recarga consome reserva e tempo simulado', 'this.state.reserveTorpedoes -= 1' in weapons and 'tube.reloadMs = Math.max(0, tube.reloadMs - elapsed)' in weapons)
    check('Snapshot de armas restaura tubos, TDC e tiros ativos', all(token in weapons for token in ('snapshot(context = {})', 'restore(snapshot)', 'activeShots', 'reserveTorpedoes', 'shotCounter')))
    check('Auxiliares de armas não colidem com o módulo de sensores no harness', all(token in weapons for token in ('normalizeWeaponBearing', 'weaponNationFrom', 'buildWeaponProfile', 'trueWeaponRangeMeters', 'trueWeaponBearing')))

    weapon_engine_tokens = [
        "import { WeaponSystem }", 'this.weapons = new WeaponSystem', 'this.weapons.update(stepMs',
        'this.weapons.drainResolutionEvents()', 'this.weapons.drainExposureEvents()',
        'setWeaponTarget(role)', 'selectTorpedoTube(id)', 'setSalvoSize(value)',
        'setTorpedoType(type)', 'setTdcValue(key, value)', 'syncTdcSolution()',
        'weapons: this.weapons.snapshot', 'weaponVersion: 1', 'snapshotVersion: 10'
    ]
    for token in weapon_engine_tokens:
        check(f'Integração de armas no motor contém: {token}', token in engine)
    check('Disparo antigo foi substituído pelo WeaponSystem', 'const result = this.weapons.fire(this.weaponContext())' in engine)
    check('Alvo principal e escolta podem ser destruídos', "resolution.targetRole === 'escort' ? 'escort' : 'target'" in engine and 'entity.destroy()' in engine and 'this.navalAI.notifyShipDestroyed(entity.id)' in engine)
    check('Estoque do HUD deriva do banco real', 'this.player.resources.torpedoes = this.weapons.totalTorpedoes()' in engine)

    weapon_ids = [
        'weapons-status', 'weapons-loaded-count', 'weapons-reserve-count', 'weapons-failure-rate',
        'weapons-max-depth', 'tdc-quality', 'tdc-quality-bar', 'tdc-bearing', 'tdc-range',
        'tdc-gyro', 'tdc-confidence', 'tdc-target-speed', 'tdc-target-course', 'tdc-aob',
        'tdc-run-depth', 'tdc-sync', 'weapons-fire', 'weapons-message', 'open-weapons-station'
    ]
    for weapon_id in weapon_ids:
        check(f'Instrumento de armas presente: {weapon_id}', f'id="{weapon_id}"' in gameplay or f"querySelector('#{weapon_id}')" in gameplay)
    check('Interface de armas lê snapshot real', 'function updateWeapons(snapshot)' in gameplay and 'const weapons = snapshot.weapons' in gameplay)
    check('Controles TDC chamam o motor', all(token in gameplay for token in ('engine.selectTorpedoTube', 'engine.setWeaponTarget', 'engine.setSalvoSize', 'engine.setTorpedoType', 'engine.setTdcValue', 'engine.syncTdcSolution', 'engine.fireTorpedo')))
    check('Tubos exibem estado e progresso de recarga', all(token in gameplay for token in ("button.classList.toggle('loaded'", "button.classList.toggle('reloading'", 'tube.reloadDurationMs')))
    check('Qualidade TDC controla instrumento real', 'tdcQualityBar.style.width' in gameplay and 'tdc.solutionQuality' in gameplay)

    weapon_css_tokens = [
        '.weapons-panel', '.weapons-layout', '.tube-rack', '.torpedo-tube.loaded',
        '.torpedo-tube.reloading', '.tdc-readout-grid', '.tdc-quality-track', '.weapon-actions',
        '@media (min-width:620px)', '@media (min-width:1024px)', '@media (max-width:380px)',
        '@media (orientation:landscape) and (max-height:540px)', '@media (prefers-reduced-motion:reduce)'
    ]
    for token in weapon_css_tokens:
        check(f'CSS de armas responsivo contém: {token}', token in weapon_css)
    check('Estação de torpedos vem antes dos relatórios no mobile', re.search(r'grid-template-areas:\s*"action"\s*"weapons"\s*"mission"', weapon_css) is not None)

    ai_keys = {
        'ai.station', 'ai.tacticalPlot', 'ai.playerSubmarine', 'ai.convoyShips', 'ai.aswThreat',
        'ai.merchant', 'ai.escort', 'ai.aircraft', 'ai.merchantsActive', 'ai.escortsActive',
        'ai.nearestEscort', 'ai.formation', 'ai.formationIntact', 'ai.formationDisrupted',
        'ai.formationEvasive', 'ai.aircraftStatus', 'ai.aircraftStandby', 'ai.aircraftUnavailable',
        'ai.aircraftPatrol', 'ai.aircraftTracking', 'ai.aircraftAttacking', 'ai.depthChargePatterns',
        'ai.noDepthCharges', 'ai.depthChargeCountdown', 'ai.formationHolding', 'ai.torpedoWakeDetected',
        'ai.escortLost', 'ai.convoyShipLost', 'ai.depthChargePatternLaunched', 'ai.depthChargeNearMiss',
        'ai.aircraftInbound', 'ai.aircraftAttackRun', 'ai.aircraftDeparted',
        'ai.hintAircraftDepthCharge', 'ai.hintCoordinatedDepthCharge',
        'ai.state.formation', 'ai.state.regroup', 'ai.state.alert', 'ai.state.search', 'ai.state.hunt',
        'ai.threat.clear', 'ai.threat.warning', 'ai.threat.critical'
    }
    check('Todas as strings de IA naval existem nos três idiomas', all(ai_keys.issubset(keys) for keys in keysets.values()), f'chaves={len(ai_keys)}')
    for lang, data in translations.items():
        blank = [key for key in ai_keys if not str(data.get(key, '')).strip()]
        check(f'Textos de IA naval não vazios: {lang}', not blank, f'vazios={blank}')

    damage_keys = {
        'damage.station', 'damage.statusSecure', 'damage.flooding', 'damage.fire', 'damage.power',
        'damage.morale', 'damage.crewFit', 'damage.crewInjured', 'damage.crewDead',
        'damage.criticalCompartments', 'damage.closeDoors', 'damage.openDoors',
        'damage.pumpsOn', 'damage.pumpsOff', 'damage.emergencyPowerOn', 'damage.emergencyPowerOff',
        'damage.assignSelected', 'damage.recall', 'damage.teamIdle', 'damage.ready',
        'damage.task.pump', 'damage.task.fire', 'damage.task.repair', 'damage.task.medical',
        'damage.compartment.bowTorpedo', 'damage.compartment.forwardBattery',
        'damage.compartment.controlRoom', 'damage.compartment.sonarRoom',
        'damage.compartment.engineRoom', 'damage.compartment.aftBattery',
        'damage.compartment.sternTorpedo', 'damage.team.1', 'damage.team.2', 'damage.team.3'
    }
    check('Todas as strings de controle de avarias existem nos três idiomas', all(damage_keys.issubset(keys) for keys in keysets.values()), f'chaves={len(damage_keys)}')
    for lang, data in translations.items():
        blank = [key for key in damage_keys if not str(data.get(key, '')).strip()]
        check(f'Textos de avarias não vazios: {lang}', not blank, f'vazios={blank}')

    ai_tokens = [
        'export class NavalAISystem', 'buildConvoy()', 'merchantShips()', 'escortShips()',
        'setGlobalState(next', 'notifyTorpedoLaunch(shots', 'notifyShipDestroyed(shipId)',
        'updateFormation(deltaMs, context)', 'updateEscorts(deltaMs, context)', 'launchDepthChargePattern',
        'updatePatterns(deltaMs, context)', 'updateAircraft(deltaMs, context)', 'drainDamageEvents()',
        'drainExposureEvents()', 'drainThreatEvents()', 'snapshot()', 'restore(snapshot = {})', 'aiVersion: 2'
    ]
    for token in ai_tokens:
        check(f'Contrato de IA naval contém: {token}', token in naval_ai)
    check('Comboio cria múltiplos mercantes e escoltas', all(token in naval_ai for token in ('merchantCount', 'escortCount', "role: index === 0 ? 'target' : 'convoy'", "role: index === 0 ? 'escort' : 'escort-support'")))
    check('Estados coordenados de IA estão definidos', all(token in naval_ai for token in ("'formation'", "'alert'", "'search'", "'hunt'", "'regroup'")))
    check('IA usa relógio simulado sem temporizadores externos', 'setTimeout' not in naval_ai and 'setInterval' not in naval_ai and 'Math.random' not in naval_ai)
    check('Temporizador de aeronave indisponível permanece serializável em JSON', 'aircraftSpawnCooldownMs: this.profile.aircraftAvailable ? 60000 : 999999999' in naval_ai)
    check('Cargas de profundidade consideram posição, profundidade e contramedidas', all(token in naval_ai for token in ('depthChargePatterns', 'depth', 'decoy', 'silentRunning')))
    check('Aeronave ASW respeita ano e disponibilidade', all(token in naval_ai for token in ('year >= 1942', 'aircraftAvailable', 'aircraftSpawnCooldownMs', 'aircraftAttacks')))

    ai_engine_tokens = [
        "import { NavalAISystem }", 'this.navalAI = new NavalAISystem',
        'this.target = this.navalAI.primaryTarget', 'this.escort = this.navalAI.primaryEscort',
        'this.navalAI.update(stepMs', 'this.navalAI.notifyTorpedoLaunch',
        'this.navalAI.notifyShipDestroyed', 'this.navalAI.drainExposureEvents()',
        'this.navalAI.drainDamageEvents()', 'this.navalAI.drainThreatEvents()',
        'navalAI: this.navalAI.snapshot()', 'snapshotVersion: 10', 'aiVersion: 2'
    ]
    for token in ai_engine_tokens:
        check(f'Integração da IA no motor contém: {token}', token in engine)
    check('Contagem de entidades acompanha força naval e aeronave', '1 + this.navalAI.ships.length' in engine and 'this.navalAI.state.aircraft.active' in engine)
    check('Snapshot anterior continua aceito sem bloco de IA', 'if (snapshot.navalAI)' in engine)

    ai_ids = [
        'hud-asw', 'hud-convoy', 'convoy-tactical-plot', 'ai-merchants-active',
        'ai-escorts-active', 'ai-nearest-escort', 'ai-formation-status', 'ai-aircraft-status',
        'ai-depth-charge-alert', 'ai-message'
    ]
    for ai_id in ai_ids:
        check(f'Instrumento de IA naval presente: {ai_id}', f'id="{ai_id}"' in gameplay or f"querySelector('#{ai_id}')" in gameplay)
    check('Interface de IA lê snapshot real', 'function updateNavalAI(snapshot)' in gameplay and 'const ai = snapshot.navalAI' in gameplay)
    check('Plot tático representa navios e aeronave do motor', all(token in gameplay for token in ('ai.ships', 'ai.aircraft', 'ai-contact-marker', 'aircraft')))
    check('Atualização geral inclui IA naval', 'updateNavalAI(snapshot)' in gameplay)

    ai_css_tokens = [
        '.naval-ai-panel', '.naval-ai-layout', '.convoy-tactical-plot', '.ai-contact-marker',
        '.ai-contact-marker.aircraft', '.ai-depth-charge-alert', '@media (min-width:700px)',
        '@media (min-width:1024px)', '@media (max-width:380px)',
        '@media (orientation:landscape) and (max-height:540px)'
    ]
    for token in ai_css_tokens:
        check(f'CSS de IA naval responsivo contém: {token}', token in ai_css)
    check('KPIs de IA são ocultados em telefone para preservar comandos', '@media (max-width:480px)' in ai_css and '.gameplay-kpis .ai-kpi' in ai_css)
    check('PWA inclui CSS e motores de IA naval e avarias', all(token in sw for token in ("'./css/phase9-ai.css'", "'./js/engine/ai/NavalAISystem.js'", "'./css/phase10-damage.css'", "'./js/engine/damage/DamageControlSystem.js'")))

    damage_tokens = [
        'export class DamageControlSystem', "applyImpact({ amount = 1, systemKey = null, sourceType = 'impact', seed = '' } = {})", 'assignTeam(teamId, compartmentId, task)',
        'recallTeam(teamId)', 'toggleWatertightDoors(force = null)', 'togglePumps(force = null)',
        'toggleEmergencyPower(force = null)', 'emergencyStabilize(amount = 12)', 'degradeSystem(systemKey, amount = 1)',
        'drainHullDamageEvents()', 'snapshot()', 'restore(snapshot)', 'damageControlVersion: 1'
    ]
    for token in damage_tokens:
        check(f'Contrato de controle de avarias contém: {token}', token in damage)
    check('Sete compartimentos internos definidos', all(token in damage for token in ("id: 'bowTorpedo'", "id: 'forwardBattery'", "id: 'controlRoom'", "id: 'sonarRoom'", "id: 'engineRoom'", "id: 'aftBattery'", "id: 'sternTorpedo'")))
    check('Três equipes independentes definidas', 'teamCount: 3' in damage and 'Array.from({ length: this.profile.teamCount }' in damage and 'id: `dc-team-${index + 1}`' in damage)
    check('Quatro tarefas de sobrevivência habilitadas', all(token in damage for token in ("'pump'", "'fire'", "'repair'", "'medical'")))
    check('Danos são determinísticos sem aleatoriedade ou timers externos', 'Math.random' not in damage and 'setTimeout' not in damage and 'setInterval' not in damage and 'deterministicRoll' in damage)
    check('Portas estanques alteram propagação', 'const doorsFactor = this.state.watertightDoorsClosed ? 0.32 : 1' in damage and "if (!this.state.watertightDoorsClosed" in damage)
    check('Bombas dependem de energia principal ou emergência', 'this.state.mainPower || this.state.emergencyPower' in damage and 'pumpsActive' in damage)
    check('Mortos não são revividos por atendimento médico', 'compartment.casualties.dead' in damage and 'casualties.dead -=' not in damage)
    check('Alagamento e incêndio críticos causam dano progressivo', 'attritionAccumulator' in damage and 'hullDamageEvents.push' in damage)
    check('Restauração limita valores de compartimentos', all(token in damage for token in ('safeNumber(saved.integrity', 'safeNumber(saved.flooding', 'safeNumber(saved.fire', 'safeNumber(saved.electricalDamage')))

    damage_engine_tokens = [
        "import { DamageControlSystem }", 'this.damageControl = new DamageControlSystem',
        'this.damageControl.update(stepMs, {', 'this.damageControl.applyImpact',
        'this.damageControl.drainHullDamageEvents()', 'assignDamageControlTeam(teamId, compartmentId, task)',
        'recallDamageControlTeam(teamId)', 'toggleWatertightDoors(force = null)', 'toggleDamageControlPumps(force = null)',
        'toggleEmergencyPower(force = null)', 'damageControl: this.damageControl.snapshot()',
        'snapshotVersion: 10', 'damageControlVersion: 1'
    ]
    for token in damage_engine_tokens:
        check(f'Integração de avarias no motor contém: {token}', token in engine)
    check('Casco e sistemas são sincronizados com avarias', 'this.player.hull = Math.min(this.player.hull, damageSnapshot.hullIntegrity)' in engine and 'this.player.systems = { ...damageSnapshot.systems }' in engine)
    check('Compressão é limitada em emergência interna', all(token in engine for token in ('totalFlooding >= 45', 'totalFire >= 35', 'criticalCompartments > 0'))) 
    check('Snapshots antigos recebem estado íntegro compatível', 'if (snapshot.damageControl)' in engine)

    damage_ids = [
        'damage-status-badge', 'damage-total-flooding', 'damage-total-fire', 'damage-power',
        'damage-morale', 'damage-crew-fit', 'damage-crew-injured', 'damage-crew-dead',
        'damage-critical-count', 'damage-doors-toggle', 'damage-pumps-toggle',
        'damage-emergency-power', 'damage-team-select', 'damage-task-select',
        'damage-team-list', 'damage-message', 'open-damage-control'
    ]
    for damage_id in damage_ids:
        check(f'Instrumento de avarias presente: {damage_id}', f'id="{damage_id}"' in gameplay or f"querySelector('#{damage_id}')" in gameplay)
    check('Sete cards de compartimento são renderizados', all(token in gameplay for token in ("'bowTorpedo'", "'forwardBattery'", "'controlRoom'", "'sonarRoom'", "'engineRoom'", "'aftBattery'", "'sternTorpedo'")) and "class=\"damage-compartment-card\"" in gameplay)
    check('Interface lê snapshot real de avarias', 'function updateDamageControl(snapshot)' in gameplay and 'const damage = snapshot.damageControl' in gameplay)
    check('Controles de avarias chamam o motor', all(token in gameplay for token in ('engine.assignDamageControlTeam', 'engine.recallDamageControlTeam', 'engine.toggleWatertightDoors', 'engine.toggleDamageControlPumps', 'engine.toggleEmergencyPower')))
    check('Botões dinâmicos usam delegação sem listeners repetidos', "bind(els.damageTeamList, 'click'" in gameplay and "querySelectorAll('.damage-recall-team').forEach" not in gameplay)
    check('Atualização geral inclui controle de avarias', 'updateDamageControl(snapshot)' in gameplay)

    damage_css_tokens = [
        '.damage-control-panel', '.damage-control-layout', '.damage-summary-grid', '.damage-summary-grid>div',
        '.damage-team-card', '.damage-compartment-grid', '.damage-compartment-card',
        '[data-state="critical"]', '@media (max-width:820px)', '@media (max-width:560px)',
        '@media (prefers-reduced-motion:reduce)'
    ]
    for token in damage_css_tokens:
        check(f'CSS de avarias responsivo contém: {token}', token in damage_css)
    check('Painel de avarias possui layout próprio e adaptativo', '.damage-control-layout' in damage_css and 'grid-template-columns:minmax(250px,.8fr) minmax(0,1.7fr)' in damage_css and '@media (max-width:820px)' in damage_css)
    check('PWA inclui CSS e módulo de controle de avarias', "'./css/phase10-damage.css'" in sw and "'./js/engine/damage/DamageControlSystem.js'" in sw)

    js_files = sorted((ROOT / 'js').rglob('*.js'))
    syntax_failures = []
    for path in js_files:
        ok, output = run(['node', '--check', str(path)])
        if not ok:
            syntax_failures.append(f'{path.relative_to(ROOT)}: {output}')
    check('Todos os JavaScript passam no parser', not syntax_failures, ' | '.join(syntax_failures[:5]))

    esm_commands = {
        'Módulo físico': "import('./js/engine/physics/SubmarinePhysicsSystem.js')",
        'Módulo de sensores': "import('./js/engine/sensors/SensorSystem.js')",
        'Módulo de armas': "import('./js/engine/weapons/WeaponSystem.js')",
        'Módulo de IA naval': "import('./js/engine/ai/NavalAISystem.js')",
        'Módulo de controle de avarias': "import('./js/engine/damage/DamageControlSystem.js')",
        'Motor de simulação': "import('./js/engine/simulation/SimulationEngine.js')",
        'Navegação': "import('./js/engine/navigation/NavigationSystem.js')",
        'Tela de gameplay': "import('./js/screens/gameplay.js')",
        'Save v3': "import('./js/save.js')",
    }
    for label, expression in esm_commands.items():
        ok, output = run(['node', '-e', f"{expression}.then(()=>console.log('IMPORT_PASS')).catch(e=>{{console.error(e);process.exit(1)}})"])
        check(f'Importação ESM: {label}', ok and 'IMPORT_PASS' in output, output)

    unit_ok, unit_output = run(['npm', 'test'])
    pass_match = re.search(r'# pass (\d+)', unit_output)
    fail_match = re.search(r'# fail (\d+)', unit_output)
    passed_units = int(pass_match.group(1)) if pass_match else 0
    failed_units = int(fail_match.group(1)) if fail_match else -1
    check('Suite unitária completa aprovada', unit_ok and passed_units >= 82 and failed_units == 0, f'pass={passed_units}, fail={failed_units}')

    passed = sum(item['status'] == 'PASS' for item in checks)
    failed = sum(item['status'] == 'FAIL' for item in checks)
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'build': build,
        'summary': {'passed': passed, 'failed': failed},
        'checks': checks,
    }
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = [
        '# Auditoria antiquebra — Fase 10.4', '',
        f"Build: **{build.get('version')}** — `{build.get('buildId')}`", '',
        f"Resultado: **{'PASS' if failed == 0 else 'FAIL'}** — {passed} aprovadas / {failed} reprovadas", '',
        '| Verificação | Status | Detalhes |', '|---|---:|---|',
    ]
    for item in checks:
        details = item['details'].replace('|', '\\|').replace('\n', ' ')
        lines.append(f"| {item['name']} | {item['status']} | {details} |")
    REPORT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')

    print(f"AUDIT {'PASS' if failed == 0 else 'FAIL'}: {passed} passed, {failed} failed")
    for item in checks:
        print(f"[{item['status']}] {item['name']} {item['details']}")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
