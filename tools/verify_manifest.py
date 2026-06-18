#!/usr/bin/env python3
"""Verify every file listed in reports/PACKAGE_MANIFEST.json."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'reports' / 'PACKAGE_MANIFEST.json'


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    failures = []
    for entry in data.get('files', []):
        path = ROOT / entry['path']
        if not path.is_file():
            failures.append(f"missing:{entry['path']}")
            continue
        if path.stat().st_size != entry['bytes']:
            failures.append(f"size:{entry['path']}")
            continue
        if sha256(path) != entry['sha256']:
            failures.append(f"hash:{entry['path']}")
    expected = int(data.get('fileCount', -1))
    if expected != len(data.get('files', [])):
        failures.append('manifest-count')
    if failures:
        print(f"MANIFEST FAIL: {len(failures)} errors")
        print('\n'.join(failures[:30]))
        return 1
    print(f"MANIFEST PASS: {expected} files verified")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
