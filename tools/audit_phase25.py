from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[1]
checks=[]
def add(name, ok, detail=''):
    checks.append((name, bool(ok), detail))
def read(path): return (root/path).read_text(encoding='utf-8')
def j(path): return json.loads(read(path))
build=j(Path('BUILD_INFO.json')); pkg=j(Path('package.json')); manifest=j(Path('manifest.json'))
index=read(Path('index.html')); sw=read(Path('service-worker.js')); gameplay=read(Path('js/screens/gameplay.js'))
add('phase metadata', build.get('semver')=='2.0.0-alpha.25' and build.get('phase')=='25', build)
add('package version', pkg.get('version')=='2.0.0-alpha.25', pkg.get('version'))
add('audit script active', pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase25.py')
add('test script active', 'tests/phase25_convoy_doctrine.test.js' in pkg.get('scripts',{}).get('test',''))
add('manifest version', manifest.get('version')=='2.0.0-alpha.25')
add('html css loaded', 'css/phase25-convoy-doctrine.css' in index)
add('service worker cache css', './css/phase25-convoy-doctrine.css' in sw)
add('service worker cache module', './js/systems/convoyDoctrine.js' in sw)
add('convoy module exists', (root/'js'/'systems'/'convoyDoctrine.js').exists())
add('gameplay imports analyzer', '../systems/convoyDoctrine.js' in gameplay)
add('gameplay renders panel', 'id="convoy-doctrine-panel"' in gameplay)
add('gameplay updates recommendation', 'convoyRecommendation' in gameplay and 'analyzeConvoyDoctrine' in gameplay)
add('mobile scroll css preserved', (root/'css'/'phase20-mobile-scroll.css').exists())
add('soundtrack preserved', (root/'assets'/'audio'/'music'/'submarine_commander_theme_06.mp3').exists())
translations=[j(Path('data/translations')/(lang+'.json')) for lang in ['pt-BR','en','es']]
keys=['convoy.title','convoy.integrity','convoy.escortScreen','convoy.zigzag','convoy.interceptWindow','convoy.doctrine.hunt','convoy.recommend.deepSilent']
for idx,lang in enumerate(['pt-BR','en','es']): add(f'translation {lang}', all(k in translations[idx] for k in keys))
failed=[c for c in checks if not c[1]]
for name, ok, detail in checks: print(('[PASS]' if ok else '[FAIL]'), name, detail if not ok else '')
if failed:
    print(f'PHASE25 AUDIT FAIL: {len(checks)-len(failed)}/{len(checks)}')
    sys.exit(1)
print(f'PHASE25 AUDIT PASS: {len(checks)}/{len(checks)}')
