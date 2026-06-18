#!/usr/bin/env python3
from __future__ import annotations
import json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REPORT_JSON=ROOT/'reports'/'phase10_3_audit.json'; REPORT_MD=ROOT/'reports'/'PHASE_10_3_AUDIT.md'
checks=[]
def check(name,condition,details=''): checks.append({'name':name,'status':'PASS' if condition else 'FAIL','details':str(details)[:1000]})
def read(path): return (ROOT/path).read_text(encoding='utf-8')
def load(path): return json.loads(read(path))
def run(cmd):
 p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True); return p.returncode==0,(p.stdout+p.stderr)

def main():
 build=load('BUILD_INFO.json'); package=load('package.json'); manifest=load('manifest.json'); index=read('index.html'); sw=read('service-worker.js')
 engine=read('js/engine/simulation/SimulationEngine.js'); env=read('js/engine/environment/EnvironmentSystem.js'); sensors=read('js/engine/sensors/SensorSystem.js'); gameplay=read('js/screens/gameplay.js'); audio=read('js/audio.js'); css=read('css/phase10-3-realism.css')
 metadata=[
 ('Versão 10.3',build.get('version')=='v2.0.0-alpha.10.3',build.get('version')),('Semver 10.3',build.get('semver')=='2.0.0-alpha.10.3',build.get('semver')),('Fase 10.3',str(build.get('phase'))=='10.3',build.get('phase')),('Nome da fase',build.get('phaseName')=='Operational Realism, Sea Environment & Sensor Fusion',build.get('phaseName')),('Build São Paulo',build.get('timezone')=='America/Sao_Paulo',build.get('timezone')),('Canal alpha',build.get('channel')=='alpha' and build.get('release') is False,build.get('channel')),('QA permitido',build.get('qaStatus') in {'PENDING','PASS'},build.get('qaStatus')),('Save schema preservado',build.get('saveSchemaVersion')==3,build.get('saveSchemaVersion')),('Package sincronizado',package.get('version')==build.get('semver'),package.get('version')),('Manifest sincronizado',manifest.get('version')==build.get('semver'),manifest.get('version')),('HTML sincronizado',build.get('version') in index,''),('Cache sincronizado',f"const CACHE_VERSION = '{build.get('semver')}';" in sw,'')]
 for x in metadata: check(*x)
 required_files=['css/phase10-3-realism.css','js/engine/environment/EnvironmentSystem.js','tests/environment.test.js','tests/operational_realism_smoke.py','docs/OPERATIONAL_REALISM_ARCHITECTURE_V1.md','QA_CHECKLIST_PHASE_10_3.md','KNOWN_ISSUES_PHASE_10_3.md','ROLLBACK_PHASE_10_3.md','RELEASE_NOTES_v2.0.0-alpha.10.3.md']
 for path in required_files: check(f'Arquivo obrigatório: {path}',(ROOT/path).is_file())
 for token in ['./css/phase10-3-realism.css','./js/engine/environment/EnvironmentSystem.js']: check(f'Cache offline inclui {token}',token in sw)
 env_tokens=['environmentVersion: 1','hashText','theatreProfile','daylightAtHour','visibilityMeters','ambientNoise','acousticPropagation','visualFactor','radarClutter','rollDegrees','pitchDegrees','horizonOffset','Deterministic slow weather evolution','snapshot()','restore(snapshot)']
 for token in env_tokens: check(f'Ambiente contém: {token}',token in env)
 sensor_tokens=['sensorVersion: 2','SOURCE_QUALITY','fuseObservation','supportingSource','recordHistory','bearingRateDegMin','rangeRateMps','speedEstimateKnots','deriveTrend','deriveAspect','ambientNoise','acousticPropagation','radarClutter','currentVisualRangeMeters','strongestContact()']
 for token in sensor_tokens: check(f'Fusão de sensores contém: {token}',token in sensors)
 engine_tokens=["import { EnvironmentSystem } from '../environment/EnvironmentSystem.js'",'this.environment = new EnvironmentSystem','this.environment.update','environment: this.environment.snapshot()','snapshotVersion: 9','environmentVersion: 1','sensorVersion: 2']
 for token in engine_tokens: check(f'Integração do motor contém: {token}',token in engine)
 ui_ids=['hud-environment','environment-time','environment-sea-state','environment-visibility','environment-wind','environment-layer','environment-noise','hydrophone-waterfall','hydrophone-listen','sensor-target-signal','sensor-target-trend','sensor-target-speed','sensor-target-age','sensor-target-history','sensor-escort-history','periscope-horizon','periscope-weather','periscope-visibility-layer','periscope-visual-quality','periscope-sea-state']
 for item in ui_ids: check(f'UI operacional: {item}',f'id="{item}"' in gameplay)
 for token in ['updateEnvironment(snapshot)','updateHydrophoneWaterfall(sensors)','renderContactHistory','contactTrendLabel','targetOpticallyVisible','escortOpticallyVisible','updateOperationalAmbience(snapshot)']: check(f'Atualização visual: {token}',token in gameplay)
 for token in ['hydrophoneMerchant','hydrophoneEscort','hydrophoneUnknown','updateOperationalAmbience']: check(f'Áudio operacional: {token}',token in audio)
 css_tokens=['.environment-strip','.hydrophone-waterfall','.contact-history','.periscope-horizon','.periscope-weather','.periscope-visibility-layer','@keyframes periscope-rain','@media (max-width:560px)','@media (prefers-reduced-motion:reduce)']
 for token in css_tokens: check(f'CSS operacional: {token}',token in css)
 translations={lang:load(f'data/translations/{lang}.json') for lang in ('pt-BR','en','es')}; keysets={k:set(v) for k,v in translations.items()}
 check('Paridade PT/EN/ES',len({frozenset(x) for x in keysets.values()})==1,{k:len(v) for k,v in keysets.items()})
 env_keys=sorted(k for k in translations['pt-BR'] if k.startswith('environment.'))
 check('Mínimo de 30 chaves ambientais',len(env_keys)>=30,len(env_keys))
 for lang,data in translations.items():
  for key in env_keys: check(f'Tradução {lang}: {key}',bool(str(data.get(key,'')).strip()))
 match=re.search(r'const APP_SHELL = \[(.*?)\];',sw,re.S); assets=re.findall(r"'([^']+)'",match.group(1)) if match else []
 for asset in assets:
  path=asset.removeprefix('./'); check(f'App shell existe: {asset}',asset=='./' or (ROOT/path).is_file())
 check('Fallback apenas para navegação',"request.mode === 'navigate'" in sw and "catch(() => caches.match('./index.html'))" not in sw)
 for path in sorted(ROOT.glob('js/**/*.js')):
  ok,out=run(['node','--check',str(path.relative_to(ROOT))]); check(f'Sintaxe JS: {path.relative_to(ROOT)}',ok,out[-250:])
 for report in ['reports/phase10_3_operational_smoke.json','reports/phase10_3_regression_smoke.json','reports/phase10_1_stabilization_smoke.json','reports/phase10_2_tactical_smoke.json']:
  data=load(report) if (ROOT/report).is_file() else {}; summary=data.get('summary',{}); check(f'Smoke aprovado: {report}',summary.get('failed')==0 and int(summary.get('passed',0))>0,summary)
 telemetry=load('reports/phase10_3_tactical_telemetry.json') if (ROOT/'reports/phase10_3_tactical_telemetry.json').is_file() else {}; summary=telemetry.get('summary',{}); check('Telemetria cobre 13 missões',summary.get('missionCount')==13,summary); check('Telemetria tática aprovada',summary.get('passed') is True,summary)
 ok,out=run(['npm','test']); check('Suite unitária completa',ok and '# fail 0' in out,out[-800:])
 passed=sum(c['status']=='PASS' for c in checks); failed=sum(c['status']=='FAIL' for c in checks)
 result={'summary':{'passed':passed,'failed':failed},'checks':checks}; REPORT_JSON.parent.mkdir(parents=True,exist_ok=True); REPORT_JSON.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 lines=['# Auditoria técnica — Fase 10.3','',f'- Aprovadas: **{passed}**',f'- Reprovadas: **{failed}**','', '| Status | Verificação | Detalhes |','|---|---|---|']
 for item in checks: lines.append(f"| {item['status']} | {item['name'].replace('|','/')} | {item['details'].replace('|','/').replace(chr(10),' ')[:420]} |")
 REPORT_MD.write_text('\n'.join(lines)+'\n')
 print(f'PHASE 10.3 AUDIT {"PASS" if failed==0 else "FAIL"}: {passed} passed, {failed} failed')
 return 0 if failed==0 else 1
if __name__=='__main__': raise SystemExit(main())
