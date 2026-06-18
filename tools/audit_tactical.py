#!/usr/bin/env python3
"""Anti-break audit for Submarine Commander WW2 v2.0.0-alpha.10.2."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_JSON = ROOT / 'reports' / 'phase10_2_audit.json'
REPORT_MD = ROOT / 'reports' / 'PHASE_10_2_AUDIT.md'
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
    return result.returncode == 0, output[-8000:]


def main() -> int:
    required = [
        'index.html', 'manifest.json', 'BUILD_INFO.json', 'package.json', 'service-worker.js',
        'README.md', 'CHANGELOG.md', 'ANTI_BREAK_PROTOCOL.md',
        'css/phase10-1-stabilization.css', 'css/phase10-2-tactical.css',
        'js/screens/gameplay.js', 'js/engine/simulation/SimulationEngine.js',
        'js/engine/ai/NavalAISystem.js', 'js/engine/tactical/TacticalEncounterSystem.js',
        'tests/tactical_encounter.test.js', 'tests/tactical_encounter_smoke.py',
        'tests/stabilization.test.js', 'tests/stabilization_smoke.py', 'tests/smoke_test.py',
        'tools/measure_tactical_balance.mjs', 'reports/phase10_2_tactical_telemetry.json',
        'reports/phase10_2_tactical_smoke.json', 'reports/phase10_2_regression_smoke.json',
        'reports/phase10_1_stabilization_smoke.json',
        'AUDITORIA_TATICA_FASE_10_2.md', 'docs/TACTICAL_ENCOUNTER_ARCHITECTURE_V1.md',
        'RELEASE_NOTES_v2.0.0-alpha.10.2.md', 'QA_CHECKLIST_PHASE_10_2.md',
        'KNOWN_ISSUES_PHASE_10_2.md', 'ROLLBACK_PHASE_10_2.md',
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
    gameplay = read('js/screens/gameplay.js')
    engine = read('js/engine/simulation/SimulationEngine.js')
    ai = read('js/engine/ai/NavalAISystem.js')
    tactical = read('js/engine/tactical/TacticalEncounterSystem.js')
    css = read('css/phase10-2-tactical.css')
    sw = read('service-worker.js')

    metadata = [
        ('Versão correta', build.get('version') == 'v2.0.0-alpha.10.2', build.get('version')),
        ('Semver correto', build.get('semver') == '2.0.0-alpha.10.2', build.get('semver')),
        ('Fase correta', str(build.get('phase')) == '10.2', build.get('phase')),
        ('Nome da fase correto', build.get('phaseName') == 'Tactical Encounter, Contact Loss & Safe Disengagement', build.get('phaseName')),
        ('Canal alpha e não release', build.get('channel') == 'alpha' and build.get('release') is False, build.get('channel')),
        ('Timezone oficial', build.get('timezone') == 'America/Sao_Paulo', build.get('timezone')),
        ('Status QA permitido', build.get('qaStatus') in {'PENDING', 'PASS'}, build.get('qaStatus')),
        ('Schema de save preservado', build.get('saveSchemaVersion') == 3, build.get('saveSchemaVersion')),
        ('Package sincronizado', package.get('version') == build.get('semver'), package.get('version')),
        ('Manifest sincronizado', manifest.get('version') == build.get('semver'), manifest.get('version')),
        ('Versão visível no HTML', build.get('version') in index, ''),
        ('CSS tático carregado', 'css/phase10-2-tactical.css' in index, ''),
        ('CSS tático em cache offline', './css/phase10-2-tactical.css' in sw, ''),
        ('Módulo tático em cache offline', './js/engine/tactical/TacticalEncounterSystem.js' in sw, ''),
        ('Cache sincronizado', f"const CACHE_VERSION = '{build.get('semver')}';" in sw, ''),
    ]
    for name, condition, details in metadata:
        check(name, condition, details)

    scripts = package.get('scripts', {})
    check('Suite geral inclui encontro tático', 'tests/tactical_encounter.test.js' in scripts.get('test', ''), scripts.get('test'))
    check('Script tático registrado', scripts.get('test:tactical') == 'node --test tests/tactical_encounter.test.js', scripts.get('test:tactical'))
    check('Telemetria tática registrada', scripts.get('telemetry:tactical') == 'node tools/measure_tactical_balance.mjs', scripts.get('telemetry:tactical'))
    check('Smoke tático registrado', scripts.get('smoke:tactical') == 'python3 tests/tactical_encounter_smoke.py', scripts.get('smoke:tactical'))
    check('Auditoria tática registrada', scripts.get('audit') == 'python3 tools/audit_tactical.py', scripts.get('audit'))

    tactical_tokens = [
        "const PHASES = Object.freeze(['patrol', 'approach', 'shadow', 'attack', 'evade', 'disengage', 'complete', 'failed'])",
        "const DOCTRINES = Object.freeze(['shadow', 'attack', 'evade', 'disengage'])",
        'requiredSafeMs: 22000', 'calculateAttackReadiness', 'calculateEnemySolution', 'safeConditions',
        "['formation', 'regroup'].includes(ai.globalState)", 'completionAuthorized', 'periscopeExposureMs',
        'escapeProgress', 'contactLost', 'metrics.safeDisengagements',
    ]
    for token in tactical_tokens:
        check(f'Motor tático contém: {token[:70]}', token in tactical)

    engine_tokens = [
        "import { TacticalEncounterSystem } from '../tactical/TacticalEncounterSystem.js'",
        'this.encounter = new TacticalEncounterSystem', 'setTacticalDoctrine(doctrine)',
        'encounterContext(overrides = {})', 'encounter: this.encounter.snapshot()', 'snapshotVersion: 8',
        'encounterVersion: 1', 'Boolean(encounterSnapshot.completionAuthorized)',
    ]
    for token in engine_tokens:
        check(f'Integração no motor contém: {token[:70]}', token in engine)
    check('Objetivo destruído não fixa caça eternamente', 'if (this.target.destroyed || this.session.detectionScore >= DETECTION_HUNT_THRESHOLD)' not in engine)
    check('Relatório bloqueado sem retirada segura', 'if (this.session.missionFailed || !this.session.canComplete) return null' in engine)

    ai_tokens = [
        'aiVersion: 2', 'hostileActionAgeMs', 'contactConfidence', 'attackSolution', 'attackPhase',
        'this.state.hostileActionAgeMs < 32000', "this.state.globalState === 'hunt' && this.state.stateAgeMs >= 12000",
        "this.setGlobalState('search', { force: true })", "this.setGlobalState('regroup', { force: true })",
        'this.state.attackSolution >= 72', 'this.state.contactConfidence >= 48',
    ]
    for token in ai_tokens:
        check(f'IA naval v2 contém: {token[:70]}', token in ai)

    ui_ids = [
        'encounter-phase', 'encounter-contact-state', 'encounter-contact-quality', 'encounter-attack-readiness',
        'encounter-enemy-solution', 'encounter-escape-progress', 'encounter-recommendation',
        'periscope-mast-time', 'ai-contact-confidence', 'ai-attack-solution', 'open-periscope',
    ]
    for item in ui_ids:
        check(f'Elemento de UI presente: {item}', f'id="{item}"' in gameplay)
    for doctrine in ['shadow', 'attack', 'evade', 'disengage']:
        check(f'Doutrina na UI: {doctrine}', f'data-doctrine="${{doctrine}}"' in gameplay or f"['shadow','attack','evade','disengage']" in gameplay)
    check('Periscópio antes do console tático no mobile', gameplay.index('id="open-periscope"') < gameplay.index('class="encounter-console"'))
    check('Campo de visão condiciona alvo do periscópio', 'targetInField' in gameplay and "targetShip?.classList.add('hidden')" in gameplay)
    check('Tempo de mastro exibido', 'periscopeExposureMs' in gameplay and 'periscopeMastTime' in gameplay)
    check('UI atualiza encontro em cada snapshot', 'updateEncounter(snapshot)' in gameplay)

    css_tokens = [
        '.encounter-console', '.encounter-timeline', '.encounter-readouts', '.encounter-doctrine-grid',
        '.encounter-doctrine.active', '.encounter-recommendation', '.periscope-window::after',
        '@media (max-width: 560px)', '@media (min-width: 900px)',
    ]
    for token in css_tokens:
        check(f'CSS tático contém: {token}', token in css)

    translations = {lang: load_json(f'data/translations/{lang}.json') or {} for lang in ('pt-BR', 'en', 'es')}
    keysets = {lang: set(data) for lang, data in translations.items()}
    check('Paridade completa PT-BR/EN/ES', len({frozenset(keys) for keys in keysets.values()}) == 1, {lang: len(keys) for lang, keys in keysets.items()})
    encounter_keys = sorted(key for key in translations['pt-BR'] if key.startswith('encounter.'))
    check('Conjunto tático possui pelo menos 35 chaves', len(encounter_keys) >= 35, len(encounter_keys))
    for lang, data in translations.items():
        for key in encounter_keys:
            check(f'Tradução não vazia {lang}: {key}', bool(str(data.get(key, '')).strip()))

    telemetry = load_json('reports/phase10_2_tactical_telemetry.json') or {}
    summary = telemetry.get('summary', {})
    assertions = telemetry.get('assertions', {})
    check('Telemetria cobre 13 missões', summary.get('missionCount') == 13, summary.get('missionCount'))
    check('Telemetria tática geral aprovada', summary.get('passed') is True, summary)
    for name, value in assertions.items():
        check(f'Asserção de telemetria: {name}', value is True, value)
    for item in telemetry.get('cautious', []):
        check(f'{item.get("missionId")} perde contato', item.get('searchAtSeconds') is not None and item.get('regroupAtSeconds') is not None, item)
        check(f'{item.get("missionId")} conclui somente após segurança', 85 <= float(item.get('completionAtSeconds') or 0) <= 120 and item.get('completionAuthorized') is True, item)
        check(f'{item.get("missionId")} preserva casco em evasão correta', item.get('finalHull') == 100, item)
    for item in telemetry.get('exposed', []):
        check(f'{item.get("missionId")} exposição impede conclusão', item.get('completionAtSeconds') is None and item.get('completionAuthorized') is False, item)
        check(f'{item.get("missionId")} exposição recebe reação ASW', item.get('firstDamageAtSeconds') is not None and int(item.get('patternsDropped') or 0) >= 4, item)

    for report in ['reports/phase10_2_tactical_smoke.json', 'reports/phase10_2_regression_smoke.json', 'reports/phase10_1_stabilization_smoke.json']:
        data = load_json(report) or {}
        result = data.get('summary', {})
        check(f'Smoke aprovado: {report}', result.get('failed') == 0 and int(result.get('passed', 0)) > 0, result)

    shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw, re.S)
    shell_assets = re.findall(r"'([^']+)'", shell_match.group(1)) if shell_match else []
    missing = []
    for asset in shell_assets:
        clean = asset.removeprefix('./')
        if clean and clean != '.' and not (ROOT / clean).is_file():
            missing.append(asset)
    check('App shell offline sem arquivos ausentes', not missing, missing)
    check('Fallback HTML apenas para navegação', "request.mode === 'navigate'" in sw and "catch(() => caches.match('./index.html'))" not in sw)

    for path in sorted(ROOT.glob('js/**/*.js')):
        ok, output = run(['node', '--check', str(path.relative_to(ROOT))])
        check(f'Sintaxe JS: {path.relative_to(ROOT)}', ok, output[-300:])

    ok, output = run(['node', '--test', 'tests/tactical_encounter.test.js'])
    check('Testes unitários táticos', ok and '# fail 0' in output, output)

    passed = sum(item['status'] == 'PASS' for item in checks)
    failed = sum(item['status'] == 'FAIL' for item in checks)
    result = {'summary': {'passed': passed, 'failed': failed}, 'checks': checks}
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = [
        '# Auditoria técnica — Fase 10.2', '',
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
