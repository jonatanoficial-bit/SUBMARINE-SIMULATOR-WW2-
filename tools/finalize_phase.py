#!/usr/bin/env python3
"""Run the mandatory anti-break gate and mark BUILD_INFO QA status."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "BUILD_INFO.json"


def set_status(status: str) -> None:
    data = json.loads(BUILD.read_text(encoding="utf-8"))
    data["qaStatus"] = status
    BUILD.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run([sys.executable, str(ROOT / "tools/sync_build.py")], cwd=ROOT, check=True)


def verify() -> None:
    subprocess.run([sys.executable, str(ROOT / "tools/audit_project.py")], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / "tests/smoke_test.py")], cwd=ROOT, check=True)


def main() -> int:
    try:
        set_status("PENDING")
        verify()
        set_status("PASS")
        verify()
        print("FINALIZE PASS")
        return 0
    except subprocess.CalledProcessError as error:
        set_status("FAIL")
        print(f"FINALIZE FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
