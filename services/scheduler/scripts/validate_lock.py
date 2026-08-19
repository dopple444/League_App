"""Fail when direct Python dependencies are not exactly pinned in lock exports."""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYPROJECT = ROOT / "pyproject.toml"
LOCKS = (ROOT / "requirements.lock", ROOT / "requirements.runtime.lock")


def dependency_name(specification: str) -> str:
    return re.split(r"\[|==", specification, maxsplit=1)[0].lower().replace("_", "-")


def main() -> int:
    project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    runtime_dependencies = project["project"]["dependencies"]
    dev_dependencies = project["project"]["optional-dependencies"]["dev"]
    errors: list[str] = []

    for dependency in [*runtime_dependencies, *dev_dependencies]:
        if "==" not in dependency:
            errors.append(f"Direct dependency must be exact: {dependency}")

    for lock in LOCKS:
        if not lock.is_file():
            errors.append(f"Missing lock export: {lock.name}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    runtime_text = LOCKS[1].read_text(encoding="utf-8").lower().replace("_", "-")
    development_text = LOCKS[0].read_text(encoding="utf-8").lower().replace("_", "-")
    for dependency in runtime_dependencies:
        name = dependency_name(dependency)
        if f"{name}==" not in runtime_text:
            errors.append(f"Runtime lock is missing {name}")
    for dependency in [*runtime_dependencies, *dev_dependencies]:
        name = dependency_name(dependency)
        if f"{name}==" not in development_text:
            errors.append(f"Development lock is missing {name}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print("Python dependency exports contain every exactly pinned direct dependency.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
