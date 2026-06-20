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
add('phase metadata', build.get('semver')=='2.0.0-alpha.24' and build.get('phase')=='24', build)
add('package version', pkg.get('version')=='2.0.0-alpha.24', pkg.get('version'))
add('audit script active', pkg.get('scripts',{}).get('audit')=='python3 tools/audit_phase24.py')
add('test script active', 'tests/phase24_ocean_weather.test.js' in pkg.get('scripts',{}).get('test',''))
add('manifest version', manifest.get('version')=='2.0.0-alpha.24')
add('html css loaded', 'css/phase24-ocean-weather.css' in index)
add('service worker cache', './css/phase24-ocean-weather.css' in sw and './js/oceanWeather.js' in sw)
add('ocean module exists', (root/'js'/'oceanWeather.js').exists())
add('gameplay imports classifier', "../oceanWeather.js" in gameplay)
add('gameplay renders panel', 'id="ocean-weather-panel"' in gameplay)
add('mobile scroll css preserved', (root/'css'/'phase20-mobile-scroll.css').exists())
add('soundtrack preserved', (root/'assets'/'audio'/'music'/'submarine_commander_theme_06.mp3').exists())
translations=[j(Path('data/translations')/(lang+'.json')) for lang in ['pt-BR','en','es']]
keys=['ocean.title','ocean.severity','ocean.cover','ocean.surfaceRisk','ocean.sonarEffect','ocean.recommendedDepth','ocean.advice','ocean.advice.silent']
for idx,lang in enumerate(['pt-BR','en','es']): add(f'translation {lang}', all(k in translations[idx] for k in keys))
failed=[c for c in checks if not c[1]]
for name, ok, detail in checks: print(('[PASS]' if ok else '[FAIL]'), name, detail if not ok else '')
if failed:
    print(f'PHASE24 AUDIT FAIL: {len(checks)-len(failed)}/{len(checks)}')
    sys.exit(1)
print(f'PHASE24 AUDIT PASS: {len(checks)}/{len(checks)}')
