#!/usr/bin/env python3
"""Anti-break audit for Submarine Commander WW2 v2.0.0-alpha.10.1."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_JSON = ROOT / 'reports' / 'phase10_1_audit.json'
REPORT_MD = ROOT / 'reports' / 'PHASE_10_1_AUDIT.md'
checks: list[dict[str, str]] = []


def check(name: str, condition: bool, details: object = '') -> None:
    checks.append({'name': name, 'status': 'PASS' if condition else 'FAIL', 'details': str(details)})


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding='utf-8')


def load_json(relative: str):
    try:
        return json.loads(read(relative))
    except Exception as exc:
        check(f'JSON válido: {relative}', False, exc)
        return None


def run(command: list[str]) -> tuple[bool, str]:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    output = (result.stdout + '\n' + result.stderr).strip()
    return result.returncode == 0, output[-6000:]


def has_all(source: str, tokens: list[str]) -> bool:
    return all(token in source for token in tokens)


def main() -> int:
    required = [
        'index.html', 'manifest.json', 'BUILD_INFO.json', 'package.json', 'service-worker.js',
        'README.md', 'CHANGELOG.md', 'ANTI_BREAK_PROTOCOL.md',
        'css/phase10-1-stabilization.css', 'js/screens/gameplay.js',
        'js/engine/simulation/SimulationEngine.js', 'js/engine/ai/NavalAISystem.js',
        'tests/stabilization.test.js', 'tests/stabilization_smoke.py', 'tests/smoke_test.py',
        'tools/measure_balance.mjs', 'reports/phase10_1_balance_telemetry.json',
        'AUDITORIA_DETALHADA_ESTABILIZACAO.md', 'docs/STABILIZATION_ARCHITECTURE_V1.md',
        'RELEASE_NOTES_v2.0.0-alpha.10.1.md', 'PHASE_10_1_DELIVERY_REPORT.md',
        'QA_CHECKLIST_PHASE_10_1.md', 'KNOWN_ISSUES_PHASE_10_1.md', 'ROLLBACK_PHASE_10_1.md',
        'data/translations/pt-BR.json', 'data/translations/en.json', 'data/translations/es.json',
    ]
    for relative in required:
        path = ROOT / relative
        check(f'Arquivo obrigatório: {relative}', path.is_file() and path.stat().st_size > 0,
              f'bytes={path.stat().st_size if path.exists() else 0}')

    forbidden = ['admin', 'js/admin.js', 'js/store.js', 'css/style.css', 'content/online-library']
    present = [item for item in forbidden if (ROOT / item).exists()]
    check('Sem resíduos de outros projetos', not present, present)

    for path in sorted(ROOT.rglob('*.json')):
        if path.name == 'PACKAGE_MANIFEST.json':
            continue
        try:
            json.loads(path.read_text(encoding='utf-8'))
            check(f'JSON parseável: {path.relative_to(ROOT)}', True)
        except Exception as exc:
            check(f'JSON parseável: {path.relative_to(ROOT)}', False, exc)

    build = load_json('BUILD_INFO.json') or {}
    package = load_json('package.json') or {}
    manifest = load_json('manifest.json') or {}
    index = read('index.html')
    css = read('css/phase10-1-stabilization.css')
    gameplay = read('js/screens/gameplay.js')
    engine = read('js/engine/simulation/SimulationEngine.js')
    ai = read('js/engine/ai/NavalAISystem.js')
    sw = read('service-worker.js')

    metadata_checks = [
        ('Versão da Fase 10.1', build.get('version') == 'v2.0.0-alpha.10.1', build.get('version')),
        ('Semver da Fase 10.1', build.get('semver') == '2.0.0-alpha.10.1', build.get('semver')),
        ('Fase identificada como 10.1', str(build.get('phase')) == '10.1', build.get('phase')),
        ('Canal alpha preservado', build.get('channel') == 'alpha' and build.get('release') is False, build.get('channel')),
        ('Timezone oficial', build.get('timezone') == 'America/Sao_Paulo', build.get('timezone')),
        ('Status QA permitido', build.get('qaStatus') in {'PENDING', 'PASS'}, build.get('qaStatus')),
        ('Save schema preservado', build.get('saveSchemaVersion') == 3, build.get('saveSchemaVersion')),
        ('Package sincronizado', package.get('version') == build.get('semver'), package.get('version')),
        ('Manifest sincronizado', manifest.get('version') == build.get('semver'), manifest.get('version')),
        ('Versão visível no HTML', build.get('version') in index, ''),
        ('CSS corretivo carregado', 'css/phase10-1-stabilization.css' in index, ''),
        ('CSS corretivo no cache offline', './css/phase10-1-stabilization.css' in sw, ''),
        ('Cache acompanha semver', f"const CACHE_VERSION = '{build.get('semver')}';" in sw, ''),
    ]
    for name, condition, details in metadata_checks:
        check(name, condition, details)

    scripts = package.get('scripts', {})
    check('Suite geral inclui estabilização', 'tests/stabilization.test.js' in scripts.get('test', ''), scripts.get('test'))
    check('Script unitário de estabilização', scripts.get('test:stabilization') == 'node --test tests/stabilization.test.js')
    check('Smoke mobile dedicado registrado', scripts.get('smoke:stabilization') == 'python3 tests/stabilization_smoke.py')
    check('Auditoria 10.1 registrada', scripts.get('audit') == 'python3 tools/audit_stabilization.py')

    station_names = ['command', 'instruments', 'sensors', 'weapons', 'navigation', 'ai', 'damage']
    for station in station_names:
        check(f'Aba da estação existe: {station}', f'data-station="{station}"' in gameplay)
        check(f'Painel da estação existe: {station}', f'data-station-panel="{station}"' in gameplay)
    check('Controlador de estações limita estados válidos', "new Set(['command','instruments','sensors','weapons','navigation','ai','damage'])" in gameplay)
    check('Somente estação ativa é exibida', '.station-panel.active' in css and 'display: none !important' in css)
    check('Ações aparecem antes dos objetivos', '.action-panel { order: 1; }' in css and '.mission-live-panel { order: 2; }' in css)

    scroll_tokens = [
        'body[data-screen="gameplay"]', 'overflow: hidden', 'body[data-screen="gameplay"] .app-shell',
        'overflow-y: auto', '-webkit-overflow-scrolling: touch', 'touch-action: pan-y pinch-zoom',
        'overscroll-behavior-y: contain', 'height: calc(var(--app-height, 100dvh)',
    ]
    for token in scroll_tokens:
        check(f'Contrato de rolagem contém: {token}', token in css)
    check('Footer da build permanece visível sem ocupar o documento', 'body[data-screen="gameplay"] .build-footer' in css and 'position: fixed' in css)

    gauge_ids = ['depth-digital', 'depth-order-digital', 'depth-needle', 'depth-command-marker', 'speed-actual-digital', 'speed-command-digital', 'hud-speed']
    for item in gauge_ids:
        check(f'Instrumento presente: {item}', f'id="{item}"' in gameplay)
    gauge_tokens = [
        'const actualDepth = Number(physics.depth ?? snapshot.depth ?? 0)',
        'const orderedDepth = Number(physics.orderedDepth ?? actualDepth)',
        'const actualSpeed = Number(physics.actualSpeedKnots || 0)',
        'els.depthNeedle.style.transform', 'els.depthCommandMarker.style.transform',
        'els.speedActualDigital.textContent', 'els.speedCommandDigital.textContent',
        'els.hudSpeed.textContent = `${Number(snapshot.physics?.actualSpeedKnots || 0).toFixed(1)} kn`',
    ]
    for token in gauge_tokens:
        check(f'Instrumentação ligada ao snapshot: {token[:55]}', token in gameplay)
    check('Origem do ponteiro explicitamente fixada', 'transform-origin: 110px 110px' in css and 'transform-box: view-box' in css)

    periscope_ids = ['periscope-bearing', 'periscope-range', 'periscope-zoom-value', 'periscope-exposure', 'periscope-zoom-out', 'periscope-zoom-in']
    for item in periscope_ids:
        check(f'Instrumento do periscópio presente: {item}', f'id="{item}"' in gameplay)
    periscope_tokens = [
        'setPeriscopeZoom', "bind(els.periscopeWindow, 'pointerdown'", "bind(els.periscopeWindow, 'pointermove'",
        "bind(els.periscopeWindow, 'wheel'", 'sightBearing', '--periscope-zoom', 'touch-action: none',
    ]
    for token in periscope_tokens:
        check(f'Periscópio operacional contém: {token}', token in gameplay or token in css)

    detection_tokens = [
        'const simulatedSeconds = Math.max(0.001, (stepMs / 1000)', 'const acousticRate =', 'const visualRate =',
        'const decayRate =', 'netRate * simulatedSeconds',
    ]
    for token in detection_tokens:
        check(f'Detecção temporal contém: {token}', token in engine)
    check('Ataque ASW exige 27 s de caça', "this.state.globalState === 'hunt' && this.state.stateAgeMs >= 27000" in ai)
    check('Fusível ASW reequilibrado', 'remainingMs: aerial ? 7000 : 9000' in ai)
    check('Cooldown de ataques repetidos aumentado', 'Math.max(26000, 34000 - this.profile.difficulty * 1100)' in ai)
    check('Movimento de escolta escalado por delta temporal', '(deltaMs / 1000) * 0.06 * aggression' in ai)
    check('Aeronave acumula confiança por segundo', 'gainRate * (simulated / 1000)' in ai)

    telemetry = load_json('reports/phase10_1_balance_telemetry.json') or {}
    balance = telemetry.get('summary', {})
    check('Telemetria cobre as 13 missões', balance.get('missionCount') == 13, balance.get('missionCount'))
    check('Patrulha silenciosa preservada em todas as missões', balance.get('quietMissionsWithoutDamage') == 13, balance.get('quietMissionsWithoutDamage'))
    check('Reação mínima ao periscópio >= 50 s', float(balance.get('minimumPeriscopeDamageSeconds', 0)) >= 50, balance.get('minimumPeriscopeDamageSeconds'))
    check('Reação mínima após torpedo >= 34 s', float(balance.get('minimumTorpedoDamageSeconds', 0)) >= 34, balance.get('minimumTorpedoDamageSeconds'))
    check('Nenhuma missão termina em 90 s após torpedo', balance.get('missionsFailedWithin90SecondsAfterTorpedo') == 0, balance.get('missionsFailedWithin90SecondsAfterTorpedo'))

    translations = {lang: load_json(f'data/translations/{lang}.json') or {} for lang in ('pt-BR', 'en', 'es')}
    keysets = {lang: set(data) for lang, data in translations.items()}
    check('Paridade PT-BR/EN/ES', len({frozenset(keys) for keys in keysets.values()}) == 1, {k: len(v) for k, v in keysets.items()})
    new_keys = {
        'stabilization.stationNavigation', 'stabilization.stationCommand', 'stabilization.stationInstruments',
        'stabilization.stationSensors', 'stabilization.stationWeapons', 'stabilization.stationNavigationShort',
        'stabilization.stationThreat', 'stabilization.stationDamage', 'stabilization.range', 'stabilization.zoom',
        'stabilization.exposure', 'stabilization.zoomOut', 'stabilization.zoomIn',
    }
    for lang, data in translations.items():
        check(f'Traduções de estabilização completas: {lang}', new_keys.issubset(data) and all(str(data[k]).strip() for k in new_keys), len(data))

    shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw, re.S)
    shell_assets = re.findall(r"'([^']+)'", shell_match.group(1)) if shell_match else []
    missing = []
    for asset in shell_assets:
        clean = asset.removeprefix('./')
        if clean and clean != '.' and not (ROOT / clean).is_file():
            missing.append(asset)
    check('App shell offline sem arquivos ausentes', not missing, missing)
    check('Fallback HTML somente para navegação', "request.mode === 'navigate'" in sw and "catch(() => caches.match('./index.html'))" not in sw)

    js_files = sorted(ROOT.glob('js/**/*.js'))
    for path in js_files:
        ok, output = run(['node', '--check', str(path.relative_to(ROOT))])
        check(f'Sintaxe JS: {path.relative_to(ROOT)}', ok, output[-250:])

    ok, output = run(['node', '--test', 'tests/stabilization.test.js'])
    check('Testes determinísticos de estabilização', ok and '# fail 0' in output, output)

    passed = sum(item['status'] == 'PASS' for item in checks)
    failed = sum(item['status'] == 'FAIL' for item in checks)
    result = {'summary': {'passed': passed, 'failed': failed}, 'checks': checks}
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = [
        '# Auditoria técnica — Fase 10.1', '',
        f'- Aprovadas: **{passed}**', f'- Reprovadas: **{failed}**', '',
        '| Status | Verificação | Detalhes |', '|---|---|---|',
    ]
    for item in checks:
        detail = item['details'].replace('|', '\\|').replace('\n', ' ')[:500]
        lines.append(f"| {item['status']} | {item['name']} | {detail} |")
    REPORT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f"AUDIT {'PASS' if failed == 0 else 'FAIL'}: {passed} passed, {failed} failed")
    for item in checks:
        if item['status'] == 'FAIL':
            print(f"[FAIL] {item['name']} {item['details']}")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
