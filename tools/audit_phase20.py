from pathlib import Path
import json, sys
root = Path(__file__).resolve().parents[1]
errors = []

def check(name, condition):
    if not condition:
        errors.append(name)

build = json.loads((root/'BUILD_INFO.json').read_text())
package = json.loads((root/'package.json').read_text())
index = (root/'index.html').read_text()
sw = (root/'service-worker.js').read_text()
css_path = root/'css'/'phase20-mobile-scroll.css'
css = css_path.read_text() if css_path.exists() else ''
check('metadata phase 20', build.get('semver') == '2.0.0-alpha.20' and str(build.get('phase')) == '20')
check('package phase 20', package.get('version') == '2.0.0-alpha.20')
check('css exists', css_path.exists())
check('index loads css after phase19', 'phase19-tdc-fire-control.css' in index and 'phase20-mobile-scroll.css' in index and index.index('phase19-tdc-fire-control.css') < index.index('phase20-mobile-scroll.css'))
check('service worker caches css', 'phase20-mobile-scroll.css' in sw and "2.0.0-alpha.20" in sw)
check('gameplay body scroll enabled', 'overflow-y: auto !important' in css and 'body[data-screen="gameplay"]' in css)
check('app shell not internal scroll trap', 'overflow-y: visible !important' in css)
check('status panel relative', '.gameplay-status-panel' in css and 'position: relative !important' in css)
check('touch pan y enabled', 'touch-action: pan-y pinch-zoom' in css)
check('periscope modal stays fixed', '.periscope-modal' in css and 'position: fixed !important' in css)
check('phase20 test registered', 'phase20_mobile_scroll.test.js' in package['scripts']['test'])
if errors:
    print('PHASE20 AUDIT FAIL')
    for e in errors: print('-', e)
    sys.exit(1)
print('PHASE20 AUDIT PASS: 11/11')
