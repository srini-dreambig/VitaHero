#!/usr/bin/env python3
"""
Static verification of the Kotlin changes.

Run it with:  python3 tools/kotlin-audit.py

This is not a substitute for `./gradlew compileDebugKotlin` — run that too. It
exists because two classes of bug here are invisible to the compiler and were
both live in this codebase:

  - a string referenced with S.<key> that has no English entry renders the raw
    key to a parent, so the Dental tab read "dental_good_msg" for a year
  - a duplicate key in a locale map is silently resolved to the last one

and because adding a value to HealthFlag can break an exhaustive `when` in a
file nobody thought to look at. Specifically it checks:

  1. a `when` over HealthFlag that is exhaustive-by-enumeration and now is not
  2. iteration over the enum that assumed three values
  3. symbols referenced but never defined, or defined twice
  4. an S.<key> with no translation, which renders the raw key to a parent
  5. a duplicate key in a locale map, which mapOf silently resolves to the last
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/user/VitaHero/android/app/src/main/java/com/rork/vitahero")
FILES = sorted(ROOT.rglob("*.kt"))
SRC = {f: f.read_text() for f in FILES}

failures = []
notes = []


def fail(msg):
    failures.append(msg)


def rel(p):
    return str(p).replace(str(ROOT) + "/", "")


# ── 1. the enum itself ──────────────────────────────────────
models = SRC[ROOT / "data/Models.kt"]
m = re.search(r"enum class HealthFlag\((.*?)\)\s*\{(.*?)\n\}", models, re.S)
if not m:
    fail("HealthFlag enum not found")
    print("\n".join(failures))
    sys.exit(1)

body = m.group(2)
members = re.findall(r"^\s*([A-Z_]+)\s*\(", body, re.M)
print("HealthFlag values: " + ", ".join(members))
if "NOT_MEASURED" not in members:
    fail("NOT_MEASURED missing from HealthFlag")
if len(members) != 4:
    fail(f"expected 4 HealthFlag values, found {len(members)}")


# ── 2. every `when` whose branches name HealthFlag ──────────
def balanced(s, i):
    """Return the substring of the block starting at the brace at/after i."""
    while i < len(s) and s[i] != "{":
        i += 1
    depth, j = 0, i
    while j < len(s):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[i:j + 1]
        j += 1
    return s[i:]


when_count = 0
for f, src in SRC.items():
    for mt in re.finditer(r"\bwhen\s*\(", src):
        block = balanced(src, mt.end())
        if "HealthFlag." not in block:
            continue
        when_count += 1
        line = src[: mt.start()].count("\n") + 1
        named = set(re.findall(r"HealthFlag\.([A-Z_]+)", block))
        has_else = re.search(r"^\s*else\s*->", block, re.M) is not None
        covered = named >= set(members)
        if not has_else and not covered:
            missing = set(members) - named
            fail(f"{rel(f)}:{line} — `when` over HealthFlag has no else and omits {sorted(missing)}")
        else:
            how = "else branch" if has_else else "all values enumerated"
            notes.append(f"  ok  {rel(f)}:{line} exhaustive ({how})")

print(f"\n`when` expressions branching on HealthFlag: {when_count}")
print("\n".join(notes))


# ── 3. iteration over the enum ──────────────────────────────
for f, src in SRC.items():
    for pat in (r"HealthFlag\.values\(\)", r"HealthFlag\.entries", r"HealthFlag\.valueOf"):
        for mt in re.finditer(pat, src):
            line = src[: mt.start()].count("\n") + 1
            kind = mt.group(0)
            if "valueOf" in kind:
                # valueOf is fine — it now parses NOT_MEASURED too.
                print(f"\n  ok  {rel(f)}:{line} {kind} — parses the new value as well")
            else:
                print(f"\n  !!  {rel(f)}:{line} {kind} — iterates the enum, now yields "
                      f"{len(members)} values. Verify the UI expects that.")


# ── 4. symbols introduced by the change ─────────────────────
def defined_once(pattern, label, where=None):
    hits = []
    for f, src in SRC.items():
        if where and where not in str(f):
            continue
        for mt in re.finditer(pattern, src, re.M):
            hits.append(f"{rel(f)}:{src[:mt.start()].count(chr(10)) + 1}")
    if len(hits) == 0:
        fail(f"{label} is never defined")
    elif len(hits) > 1:
        fail(f"{label} defined {len(hits)} times: {hits}")
    return hits


print("\nsymbol definitions:")
for pat, label in [
    (r"^val FlagNeutral\s*=", "FlagNeutral colour"),
    (r"^\s*const val notMeasuredMsg\s*=", "S.notMeasuredMsg key"),
    (r"^\s*val mutedPaint\s*=", "mutedPaint"),
]:
    hits = defined_once(pat, label)
    if hits:
        print(f"  ok  {label} -> {hits[0]}")

# every file that names a symbol must be able to see it
for sym, home in [("FlagNeutral", "ui/theme/Color.kt"), ("HealthFlag", "data/Models.kt")]:
    for f, src in SRC.items():
        if home in str(f):
            continue
        uses = re.search(rf"\b{sym}\b", src)
        if not uses:
            continue
        same_pkg = f.parent == (ROOT / home).parent
        imported = re.search(rf"^import .*\.{sym}$", src, re.M) is not None
        if not (same_pkg or imported):
            line = src[: uses.start()].count("\n") + 1
            fail(f"{rel(f)}:{line} — uses {sym} but neither imports it nor shares its package")


# ── 5. every S.<key> resolves to a translation ──────────────
locale = SRC[ROOT / "data/LocaleStrings.kt"]
declared = set(re.findall(r"const val (\w+)\s*=", locale))

referenced = set()
for f, src in SRC.items():
    referenced |= set(re.findall(r"\bS\.(\w+)\b", src))

undeclared = referenced - declared
if undeclared:
    fail(f"S.<key> referenced but never declared: {sorted(undeclared)}")

# The en map is the fallback for every locale; a key missing there renders raw.
en_block = locale[locale.index("private val en = mapOf("):locale.index("private val hi = mapOf(")]
en_keys = re.findall(r"S\.(\w+)\s+to\s", en_block)
missing_en = referenced - set(en_keys)
if missing_en:
    fail(f"referenced keys with no English translation (would render the raw key "
         f"to a parent): {sorted(missing_en)}")

print(f"\nlocale: {len(declared)} keys declared, {len(referenced)} referenced, "
      f"{len(set(en_keys))} translated in English")


# ── 6. duplicate keys inside any locale map ─────────────────
for name, start_marker, end_marker in [
    ("en", "private val en = mapOf(", "private val hi = mapOf("),
    ("hi", "private val hi = mapOf(", "private val te = mapOf("),
    ("te", "private val te = mapOf(", "private val allTranslations"),
]:
    block = locale[locale.index(start_marker):locale.index(end_marker)]
    keys = re.findall(r"S\.(\w+)\s+to\s", block)
    dupes = {k for k in keys if keys.count(k) > 1}
    if dupes:
        fail(f"locale map `{name}` has duplicate keys (mapOf silently keeps the "
             f"last): {sorted(dupes)}")
    else:
        print(f"  ok  `{name}` map: {len(keys)} entries, no duplicates")


# ── 7. leftover references to things that were removed ──────
for gone in ["deriveCampFlags", "ensureCampKidResults"]:
    for f, src in SRC.items():
        if gone in src:
            fail(f"{rel(f)} still references removed backend helper {gone}")

# unused-import check for the file the change emptied
kids_screen = SRC[ROOT / "ui/screens/KidsScreen.kt"]
if "import com.rork.vitahero.data.HealthFlag" in kids_screen and "HealthFlag" not in \
        kids_screen.replace("import com.rork.vitahero.data.HealthFlag", ""):
    fail("KidsScreen.kt imports HealthFlag but no longer uses it")


# ── 7b. translation coverage ────────────────────────────────
#
# Hindi and Telugu are partial by design — anything missing falls back to
# English, which is legible but not what a Telugu-speaking parent in Hyderabad
# should get. Reported so the gap is visible rather than forgotten.
for name in ("hi", "te"):
    m = re.search(r"private val " + name + r" = mapOf\((.*?)\n\)", locale, re.S)
    if m:
        n = len(re.findall(r"S\.(\w+) to ", m.group(1)))
        total = len(re.findall(r"S\.(\w+) to ",
                               re.search(r"private val en = mapOf\((.*?)\n\)", locale, re.S).group(1)))
        pct = round(100 * n / total)
        print(f"  note {name}: {n}/{total} strings translated ({pct}%); "
              f"the rest fall back to English")


# ── 8. redeclaration in object S ────────────────────────────
#
# Two `const val` of the same name is a compile error, and two different names
# holding the same string key silently collapse in the locale maps. The second
# one bit: a camp-consent "No, not this time" quietly overwrote the app's own
# "Not now", which is the sort of thing nobody notices until a parent does.
decls = re.findall(r'const val (\w+) = "([^"]+)"', locale)
names = [n for n, _ in decls]
dupe_names = sorted({n for n in names if names.count(n) > 1})
if dupe_names:
    fail(f"object S declares the same name twice (a compile error): {dupe_names}")
else:
    print(f"  ok  object S: {len(names)} constants, no redeclarations")

by_key = {}
for n, k in decls:
    by_key.setdefault(k, []).append(n)
shared = {k: v for k, v in by_key.items() if len(v) > 1}
if shared:
    fail(f"two constants share one string key, so one overwrites the other: {shared}")


# ── 9. project imports resolve to a file that exists ────────
#
# A screen that imports a composable nobody wrote fails at compile time, and
# these files were added in a batch, so a stale name is easy to leave behind.
declared = set()
for f, src in SRC.items():
    pkg = re.search(r"^package ([\w.]+)", src, re.M)
    if not pkg:
        continue
    for m in re.finditer(r"^(?:@\w+\s*)?(?:public |internal |private )?"
                         r"(?:fun|class|object|interface|enum class|data class|val|const val) "
                         r"(\w+)", src, re.M):
        declared.add(pkg.group(1) + "." + m.group(1))

missing = set()
for f, src in SRC.items():
    for m in re.finditer(r"^import (com\.rork\.vitahero\.[\w.]+)", src, re.M):
        name = m.group(1)
        if name.endswith(".*"):
            continue
        generated = ("com.rork.vitahero.BuildConfig", "com.rork.vitahero.R")
        if name not in declared and not name.startswith(generated):
            missing.add(f"{rel(f)} imports {name}, which nothing declares")
for x in sorted(missing):
    fail(x)
if not missing:
    print(f"  ok  every com.rork.vitahero import resolves ({len(declared)} declarations)")


# ── 10. brackets balance ────────────────────────────────────
#
# Cheap, and it catches the one mistake a large generated edit actually makes.
def balanced(src):
    depth = {"(": 0, "[": 0, "{": 0}
    close = {")": "(", "]": "[", "}": "{"}
    i, n = 0, len(src)
    in_str = in_char = in_line_c = in_block_c = False
    in_raw = False
    while i < n:
        c = src[i]
        two = src[i:i + 2]
        three = src[i:i + 3]
        if in_line_c:
            if c == "\n":
                in_line_c = False
        elif in_block_c:
            if two == "*/":
                in_block_c = False
                i += 1
        elif in_raw:
            if three == '"""':
                in_raw = False
                i += 2
        elif in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif in_char:
            if c == "\\":
                i += 1
            elif c == "'":
                in_char = False
        elif two == "//":
            in_line_c = True
            i += 1
        elif two == "/*":
            in_block_c = True
            i += 1
        elif three == '"""':
            in_raw = True
            i += 2
        elif c == '"':
            in_str = True
        elif c == "'":
            in_char = True
        elif c in depth:
            depth[c] += 1
        elif c in close:
            depth[close[c]] -= 1
            if depth[close[c]] < 0:
                return c
        i += 1
    for k, v in depth.items():
        if v != 0:
            return f"{k} unbalanced by {v}"
    return None

unbalanced = 0
for f, src in SRC.items():
    problem = balanced(src)
    if problem:
        fail(f"{rel(f)} has unbalanced brackets: {problem}")
        unbalanced += 1
if not unbalanced:
    print(f"  ok  brackets balance in all {len(SRC)} files")


# ── 11. named arguments match a declared parameter ──────────
#
# The riskiest thing about wiring new screens by hand is calling one with an
# argument name it does not have. Checked only for composables this project
# declares, and only where the call names its arguments.
def params_of(src, fname):
    m = re.search(r"\bfun " + re.escape(fname) + r"\s*\(", src)
    if not m:
        return None
    i = m.end()
    depth, out = 1, []
    while i < len(src) and depth:
        if src[i] == "(":
            depth += 1
        elif src[i] == ")":
            depth -= 1
        out.append(src[i])
        i += 1
    body = "".join(out[:-1])
    # KDoc above a parameter would otherwise swallow its name.
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    body = re.sub(r"//[^\n]*", "", body)
    # top-level commas only
    # Only real brackets: a lambda type such as `() -> Unit` contains a `>`
    # that must not be read as a closing angle bracket.
    parts, depth, cur = [], 0, ""
    for ch in body:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    names = set()
    for part in parts:
        pm = re.match(r"\s*(?:@\w+\s*)*(?:vararg\s+)?(\w+)\s*:", part)
        if pm:
            names.add(pm.group(1))
    return names

SCREENS = {}
for f, src in SRC.items():
    for m in re.finditer(r"^@Composable\s*\n(?:private |internal )?fun (\w+)\s*\(", src, re.M):
        SCREENS[m.group(1)] = params_of(src, m.group(1))

bad_args = []


def split_top(text):
    """Split an argument list on commas that are not inside a nested bracket."""
    parts, depth, cur = [], 0, ""
    in_str = False
    i = 0
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                cur += text[i:i + 2]
                i += 2
                continue
            if ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
            i += 1
            continue
        cur += ch
        i += 1
    parts.append(cur)
    return parts


for f, src in SRC.items():
    for name, allowed in SCREENS.items():
        if not allowed:
            continue
        for m in re.finditer(r"(?<![\w.])" + re.escape(name) + r"\s*\(", src):
            # the declaration itself, not a call
            head = src[max(0, m.start() - 40):m.start()]
            if re.search(r"fun\s+$", head):
                continue
            i, depth = m.end(), 1
            while i < len(src) and depth:
                if src[i] == "(":
                    depth += 1
                elif src[i] == ")":
                    depth -= 1
                i += 1
            args = src[m.end():i - 1]
            for part in split_top(args):
                am = re.match(r"\s*(\w+)\s*=(?!=)", part)
                if am and am.group(1) not in allowed:
                    bad_args.append(
                        f"{rel(f)} calls {name}({am.group(1)} = ...), but {name} has no "
                        f"such parameter (it takes: {', '.join(sorted(allowed))})")
for x in sorted(set(bad_args)):
    fail(x)
if not bad_args:
    print(f"  ok  named arguments match declarations for {len(SCREENS)} composables")


# ── result ──────────────────────────────────────────────────
print("\n" + "=" * 60)
if failures:
    print(f"{len(failures)} PROBLEM(S):")
    for x in failures:
        print("  FAIL  " + x)
    sys.exit(1)
print(f"No problems found across {len(FILES)} Kotlin files.")
print("This is a static audit, not a compiler. It cannot prove the app builds.")
