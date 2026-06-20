from pathlib import Path
import json
import sys
root = Path(__file__).resolve().parents[1]
checks = []

def check(name, condition, detail=''):
    checks.append((name, bool(condition), detail))

build = json.loads((root/'BUILD_INFO.json').read_text(encoding='utf-8'))
pkg = json.loads((root/'package.json').read_text(encoding='utf-8'))
audio = (root/'js'/'audio.js').read_text(encoding='utf-8')
sw = (root/'service-worker.js').read_text(encoding='utf-8')
check('phase metadata', build.get('semver') == '2.0.0-alpha.22' and build.get('phase') == '22')
check('package version', pkg.get('version') == '2.0.0-alpha.22')
check('audit script active', pkg.get('scripts', {}).get('audit') == 'python3 tools/audit_phase22.py')
check('soundtrack export', 'getSoundtrackPlaylist' in audio and 'startSoundtrackPlaylist' in audio)
check('ended advances track', "addEventListener('ended', () => playNextSoundtrackTrack())" in audio)
check('playlist loop arithmetic', 'musicIndex = (musicIndex + 1) % MUSIC_PLAYLIST.length' in audio)
for index in range(1, 7):
    rel = f'assets/audio/music/submarine_commander_theme_0{index}.mp3'
    path = root/rel
    check(f'music asset {index}', path.exists() and path.stat().st_size > 1_000_000, rel)
    check(f'music asset {index} cached', f'./{rel}' in sw, rel)
check('phase 21 preserved', (root/'css'/'phase21-damage-emergency.css').exists() and (root/'tests'/'damage_emergency_phase21.test.js').exists())
failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")
if failed:
    print(f'PHASE22 AUDIT FAIL: {len(checks)-len(failed)}/{len(checks)}')
    sys.exit(1)
print(f'PHASE22 AUDIT PASS: {len(checks)}/{len(checks)}')
