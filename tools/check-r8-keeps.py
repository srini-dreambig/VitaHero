#!/usr/bin/env python3
"""Did R8 keep the serializers, or did it quietly take them away?

The release build is the only build that runs R8, and the failure it can
produce is not a build failure. kotlinx.serialization generates a
`Foo$$serializer` class for each @Serializable type, nothing in the Kotlin
names it, and R8 removes what looks unreachable. The app then builds,
installs, starts, signs in — and throws SerializationException on the first
response it parses.

proguard-rules.pro keeps those classes BY PACKAGE NAME:

    -keep,includedescriptorclasses class kallam.healthcare.**$$serializer { *; }

which is a string, checked by nothing. The package moved from com.rork.vitahero
to kallam.healthcare today. Had that line been missed the rule would still have
been valid, still have matched nothing, and every debug build would still have
been perfect.

So: read the @Serializable classes out of the Kotlin, read the type names out
of the built DEX, and report which ones the build actually kept. No Android
tooling needed — a DEX carries its type descriptors as plain strings.

    tools/check-r8-keeps.py android/app/build/outputs/apk/release/

Give it the output directory rather than a file and it finds the archive
itself. That is not convenience: an unsigned release APK is called
app-release-unsigned.apk and a signed one app-release.apk, so a hardcoded
name works until somebody configures signing, or — as happened here — does
not work until they do.
"""
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "android/app/src/main/java"

# @Serializable sits on its own line above the declaration, often with other
# annotations between them, so this cannot be done a line at a time — the first
# version of this was a grep and reported zero classes, which it would have
# called a pass.
DECL = re.compile(
    r"@Serializable\b[^\n]*\n(?:\s*(?://[^\n]*|@[A-Za-z][^\n]*)\n)*"
    r"\s*(?:public\s+|internal\s+|private\s+)?(?:data\s+|value\s+)?class\s+([A-Za-z0-9_]+)"
)


def declared() -> set[str]:
    out = set()
    for f in SRC.rglob("*.kt"):
        for m in DECL.finditer(f.read_text(encoding="utf-8")):
            out.add(m.group(1))
    return out


def serializers_in(archive: Path) -> set[str]:
    found = set()
    with zipfile.ZipFile(archive) as z:
        dex = [n for n in z.namelist() if re.search(r"classes\d*\.dex$", n)]
        if not dex:
            raise SystemExit(f"check-r8-keeps: no DEX inside {archive}")
        for name in dex:
            blob = z.read(name)
            for m in re.finditer(rb"[A-Za-z0-9_/$]+\$\$serializer", blob):
                found.add(m.group(0).decode().rsplit("/", 1)[-1])
    return found


def resolve(given: Path) -> Path:
    """The archive to read, whether given a file, a directory or a glob."""
    if given.is_file():
        return given
    if given.is_dir():
        found = sorted(p for p in given.iterdir()
                       if p.suffix in (".apk", ".aab") and p.is_file())
    else:
        found = sorted(Path(given.parent).glob(given.name))
    if not found:
        raise SystemExit(f"check-r8-keeps: no .apk or .aab at {given}")
    if len(found) > 1:
        names = ", ".join(p.name for p in found)
        raise SystemExit(
            f"check-r8-keeps: {given} holds more than one archive ({names}) — "
            "name the one to check"
        )
    print(f"check-r8-keeps: reading {found[0].name}")
    return found[0]


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit(f"usage: {sys.argv[0]} <release .apk or .aab>")
    archive = resolve(Path(sys.argv[1]))

    want = declared()
    # A parse that finds nothing must fail loudly rather than pass vacuously.
    if len(want) < 20:
        raise SystemExit(
            f"check-r8-keeps: only found {len(want)} @Serializable classes in {SRC} — "
            "the parse is broken, not the build"
        )

    kept = serializers_in(archive)
    missing = sorted(c for c in want if f"{c}$$serializer" not in kept)

    print(f"check-r8-keeps: {len(want)} @Serializable classes declared, "
          f"{len(kept)} serializers in the DEX")

    if missing:
        print(f"\nR8 removed the generated serializer for {len(missing)} class(es):",
              file=sys.stderr)
        for c in missing:
            print(f"  {c}", file=sys.stderr)
        print(
            "\nThis build installs, runs, and throws on the first response it parses.\n"
            "Check the -keep line in android/app/proguard-rules.pro still names the\n"
            "package the Kotlin actually uses.",
            file=sys.stderr,
        )
        return 1

    print("check-r8-keeps: every serializer survived R8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
