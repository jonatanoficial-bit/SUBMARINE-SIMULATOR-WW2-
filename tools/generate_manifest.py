#!/usr/bin/env python3
"""Generate a SHA-256 package manifest for the current build."""
from __future__ import annotations
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'reports' / 'PACKAGE_MANIFEST.json'
EXCLUDED_PARTS = {'.git', 'node_modules', '__pycache__'}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def included(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if path == OUTPUT or any(part in EXCLUDED_PARTS for part in relative.parts):
        return False
    if path.name == '.DS_Store' or path.suffix == '.pyc':
        return False
    return path.is_file()


def main() -> None:
    build = json.loads((ROOT / 'BUILD_INFO.json').read_text(encoding='utf-8'))
    files = []
    total = 0
    for path in sorted(ROOT.rglob('*')):
        if not included(path):
            continue
        size = path.stat().st_size
        total += size
        files.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': size, 'sha256': sha256(path)})
    payload = {
        'product': build['product'], 'studio': build['studio'], 'version': build['version'],
        'phase': build['phase'], 'phaseName': build['phaseName'], 'buildId': build['buildId'],
        'qaStatus': build['qaStatus'], 'generatedAt': datetime.now(timezone.utc).isoformat(),
        'fileCount': len(files), 'totalBytes': total, 'hashAlgorithm': 'SHA-256', 'files': files,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"MANIFEST PASS: {len(files)} files, {total} bytes")

if __name__ == '__main__':
    main()
