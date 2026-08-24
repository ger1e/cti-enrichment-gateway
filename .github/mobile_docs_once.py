from pathlib import Path
import re

TARGETS = [
    Path("CHANGELOG.md"),
    Path("CONTRIBUTING.md"),
    Path("SECURITY.md"),
    Path("docs/API.md"),
    Path("docs/ARCHITECTURE.md"),
    Path("docs/BRAND.md"),
    Path("docs/END-TO-END-EXAMPLE.md"),
    Path("docs/EVIDENCE-SCHEMA.md"),
    Path("docs/OPERATIONS.md"),
    Path("docs/PROVIDERS.md"),
    Path("docs/PUBLIC-RELEASE-CHECKLIST.md"),
    Path("docs/SECURITY-CONTROLS.md"),
    Path("docs/THREAT-MODEL.md"),
    Path("maltego/README-compatibility.md"),
    Path("maltego/README.md"),
]

HEADING = re.compile(r"^(#{1,6})(\s+.*)$")

def compact(text: str) -> str:
    out = []
    in_fence = False
    fence = None
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            marker = stripped[:3]
            if not in_fence:
                in_fence = True
                fence = marker
            elif marker == fence:
                in_fence = False
                fence = None
            out.append(line)
            continue
        if not in_fence:
            m = HEADING.match(line.rstrip("\r\n"))
            if m:
                level = min(len(m.group(1)) + 2, 6)
                ending = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else ""
                line = "#" * level + m.group(2) + ending
        out.append(line)
    return "".join(out)

for path in TARGETS:
    original = path.read_text(encoding="utf-8")
    updated = compact(original)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
