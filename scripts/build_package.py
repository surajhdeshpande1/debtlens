"""Build the `debtlens` PyPI package (sdist + wheel) into dist/.

    python scripts/build_package.py            # needs: pip install build
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "packaging" / "build"
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache")


def main() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    shutil.copytree(ROOT / "debtlens", STAGE / "debtlens", ignore=IGNORE)
    shutil.copytree(ROOT / "public", STAGE / "debtlens" / "web", ignore=IGNORE)  # for `debtlens serve`
    shutil.copy(ROOT / "packaging" / "pyproject.toml", STAGE / "pyproject.toml")
    shutil.copy(ROOT / "README.md", STAGE / "README.md")
    out = ROOT / "dist"
    out.mkdir(exist_ok=True)
    subprocess.run([sys.executable, "-m", "build", "--outdir", str(out), str(STAGE)], check=True)
    print("built:", ", ".join(p.name for p in sorted(out.glob("debtlens-*"))))


if __name__ == "__main__":
    main()
