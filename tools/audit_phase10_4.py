#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name, ok, detail=''):
    checks.append((name,bool(ok),detail))

def text(path): return (ROOT/path).read_text(encoding='utf-8')

def main():
    build=json.loads(text('BUILD_INFO.json'))
    check('version', build.get('semver')=='2.0.0-alpha.10.4', build.get('semver',''))
    check('phase', build.get('phase')=='10.4', build.get('phase',''))
    check('difficulty module', (ROOT/'js/engine/training/DifficultyProfile.js').exists())
    check('training module', (ROOT/'js/engine/training/OperationalTraining.js').exists())
    check('training css', (ROOT/'css/phase10-4-training.css').exists())
    sw=text('service-worker.js')
    for path in ['css/phase10-4-training.css','js/engine/training/DifficultyProfile.js','js/engine/training/OperationalTraining.js']:
        check('offline '+path, path in sw)
    index=text('index.html'); check('css linked','phase10-4-training.css' in index)
    app=text('js/app.js'); check('difficulty passed','difficulty: state.settings.difficulty' in app); check('tutorial passed','tutorialEnabled: state.settings.tutorials' in app)
    game=text('js/screens/gameplay.js')
    for token in ['operational-guide','station-help-drawer','OperationalTraining','difficulty-badge']:
        check('gameplay '+token, token in game)
    sim=text('js/engine/simulation/SimulationEngine.js')
    for token in ['getDifficultyProfile','enemyDetectionMultiplier','enemyDamageMultiplier','resourceConsumptionMultiplier','snapshotVersion: 10']:
        check('engine '+token, token in sim)
    langs=[]
    for lang in ['pt-BR','en','es']:
        data=json.loads(text(f'data/translations/{lang}.json')); langs.append(data)
        check(lang+' training keys', all(k in data for k in ['training.guideTitle','training.help.command','training.difficulty.hardcore','training.step.safe']))
    check('translation parity', set(langs[0])==set(langs[1])==set(langs[2]), str([len(x) for x in langs]))
    js_files=list(ROOT.glob('js/**/*.js'))
    check('no merge markers', not any('<<<<<<<' in p.read_text(encoding='utf-8') for p in js_files))
    passed=sum(ok for _,ok,_ in checks)
    report={'phase':'10.4','total':len(checks),'passed':passed,'failed':len(checks)-passed,'checks':[{'name':n,'pass':o,'detail':d} for n,o,d in checks]}
    (ROOT/'reports/phase10_4_audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f'PHASE 10.4 AUDIT: {passed}/{len(checks)} PASS')
    for n,o,d in checks:
        print(('PASS' if o else 'FAIL'),n,d)
    return 0 if passed==len(checks) else 1
if __name__=='__main__': raise SystemExit(main())
