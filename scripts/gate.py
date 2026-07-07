#!/usr/bin/env python3
"""Gate de qualidade — roda no pre-commit e no pre-push (.githooks/).

Regras (reprovou, bloqueia o commit/push):
1. Todo arquivo produtivo tem no maximo 500 LOC (linhas nao-vazias).
2. Linhas de teste nao contam como LOC produtiva: arquivos de teste sao
   ignorados por inteiro e, em arquivos mistos, os blocos de teste sao
   descontados (funcoes test_* / classes Test* em Python; blocos
   describe(/it(/test( em JS/TS).
3. Cobertura minima de 95% no backend (pytest --cov-fail-under=95, em
   apps/api/pyproject.toml) e no frontend (thresholds do vitest, em
   apps/web/vite.config.ts).

Uso: python scripts/gate.py [--loc-only] [--self-check]
"""

import ast
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_LOC = 500
SRC_DIRS = [ROOT / "apps" / "api", ROOT / "apps" / "web" / "src"]
CODE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx"}
TEST_FILE = re.compile(r"(^test_|_test\.py$|\.test\.|\.spec\.)")
TEST_DIRS = {"tests", "__tests__"}
SKIP_DIRS = {"node_modules", "dist", ".venv", "__pycache__", "coverage", "htmlcov"}


def is_test_file(path: Path) -> bool:
    if any(part in TEST_DIRS for part in path.parts):
        return True
    return bool(TEST_FILE.search(path.name))


def py_test_lines(source: str) -> set[int]:
    """Linhas ocupadas por funcoes test_* / classes Test* (testes inline)."""
    lines: set[int] = set()
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return lines
    for node in ast.walk(tree):
        name = getattr(node, "name", "")
        is_test_fn = isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and name.startswith("test_")
        is_test_cls = isinstance(node, ast.ClassDef) and name.startswith("Test")
        if is_test_fn or is_test_cls:
            lines.update(range(node.lineno, node.end_lineno + 1))
    return lines


def js_test_lines(source: str) -> set[int]:
    """Linhas de blocos describe(/it(/test( (testes inline em JS/TS).

    ponytail: rastreio ingenuo de parenteses/chaves — nao entende brackets
    dentro de strings. Suficiente ate alguem escrever teste inline exotico;
    o upgrade seria um tokenizer de verdade.
    """
    lines: set[int] = set()
    depth, in_block = 0, False
    start = re.compile(r"^\s*(describe|it|test)\s*(\.\w+)?\s*\(")
    for i, line in enumerate(source.splitlines(), 1):
        if not in_block and start.match(line):
            in_block, depth = True, 0
        if in_block:
            lines.add(i)
            depth += line.count("(") + line.count("{") - line.count(")") - line.count("}")
            if depth <= 0:
                in_block = False
    return lines


def check_loc() -> list[str]:
    failures = []
    for src in SRC_DIRS:
        for path in sorted(src.rglob("*")):
            if not path.is_file() or path.suffix not in CODE_EXT:
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if is_test_file(path):
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            test_lines = py_test_lines(text) if path.suffix == ".py" else js_test_lines(text)
            loc = sum(
                1
                for i, line in enumerate(text.splitlines(), 1)
                if line.strip() and i not in test_lines
            )
            if loc > MAX_LOC:
                failures.append(f"{path.relative_to(ROOT)}: {loc} LOC produtivas (max {MAX_LOC})")
    return failures


def run(cmd: str, cwd: Path) -> int:
    print(f"\n$ {cmd}  (em {cwd.relative_to(ROOT)})")
    return subprocess.run(cmd, cwd=cwd, shell=True).returncode


def check_coverage() -> list[str]:
    api = ROOT / "apps" / "api"
    venv_py = api / ".venv" / "Scripts" / "python.exe"
    python = str(venv_py) if venv_py.exists() else sys.executable
    failures = []
    if run(f'"{python}" -m pytest', api) != 0:
        failures.append("backend: pytest falhou ou cobertura < 95%")
    if run("npx vitest run --coverage", ROOT / "apps" / "web") != 0:
        failures.append("frontend: vitest falhou ou cobertura < 95%")
    return failures


def self_check() -> None:
    py = "def foo():\n    return 1\n\ndef test_foo():\n    assert foo() == 1\n"
    assert py_test_lines(py) == {4, 5}, py_test_lines(py)
    js = "const a = 1\ntest('a', () => {\n  expect(a).toBe(1)\n})\n"
    assert js_test_lines(js) == {2, 3, 4}, js_test_lines(js)
    print("self-check OK")


def main() -> int:
    if "--self-check" in sys.argv:
        self_check()
        return 0
    print(f"== GATE 1: max {MAX_LOC} LOC produtivas por arquivo ==")
    loc_failures = check_loc()
    for f in loc_failures:
        print(f"  FALHA: {f}")
    if not loc_failures:
        print("  OK")
    cov_failures = []
    if "--loc-only" not in sys.argv:
        print("\n== GATE 2: cobertura minima de 95% (api + web) ==")
        cov_failures = check_coverage()
        for f in cov_failures:
            print(f"  FALHA: {f}")
    if loc_failures or cov_failures:
        print("\nGATE REPROVADO — commit/push bloqueado.")
        return 1
    print("\nGATE APROVADO.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
