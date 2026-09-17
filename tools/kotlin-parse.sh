#!/usr/bin/env bash
# Parse every Kotlin file with the real Kotlin compiler.
#
# Why this exists, when tools/kotlin-audit.py already runs: that script is
# regular expressions, and it cannot see a syntax error. Twice in one week a
# dangling comma left by an automated edit sailed past it — bracket counting
# reads `foo(a,\n,\n b)` as perfectly balanced — and was caught by grep and
# luck. This runs the actual front end, which says
#
#   error: syntax error: Expecting a parameter declaration.
#
# What it cannot do is type-check. dl.google.com is blocked by policy in the
# environment this project is built in, so no AndroidX, Compose or Ktor
# artifact can be resolved and every reference to one is reported as
# unresolved. Those are filtered out; what is left is classpath-independent and
# real. It is not a substitute for ./gradlew compileDebugKotlin — it is what is
# available when that cannot run.
#
#   ./tools/kotlin-parse.sh
set -uo pipefail

KOTLIN_VERSION="$(grep -oP '^kotlin = "\K[^"]+' "$(dirname "$0")/../android/gradle/libs.versions.toml")"
COROUTINES_VERSION=1.10.2
CACHE="${KOTLIN_PARSE_CACHE:-${TMPDIR:-/tmp}/vitahero-kotlinc}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/android/app/src/main/java"
CENTRAL=https://repo1.maven.org/maven2

mkdir -p "$CACHE"
fetch() { # name version group-path
  local jar="$CACHE/$1.jar"
  [ -s "$jar" ] && return 0
  echo "fetching $1 $2…" >&2
  curl -sS -fL -m 300 -o "$jar" "$CENTRAL/$3/$1/$2/$1-$2.jar" || {
    echo "kotlin-parse: could not download $1 — skipping the parse" >&2
    rm -f "$jar"; return 1
  }
}

fetch kotlin-compiler-embeddable "$KOTLIN_VERSION" org/jetbrains/kotlin || exit 0
fetch kotlin-stdlib             "$KOTLIN_VERSION" org/jetbrains/kotlin || exit 0
fetch kotlin-reflect            "$KOTLIN_VERSION" org/jetbrains/kotlin || exit 0
fetch kotlin-script-runtime     "$KOTLIN_VERSION" org/jetbrains/kotlin || exit 0
fetch kotlin-daemon-embeddable  "$KOTLIN_VERSION" org/jetbrains/kotlin || exit 0
fetch kotlinx-coroutines-core-jvm "$COROUTINES_VERSION" org/jetbrains/kotlinx || exit 0

CP="$CACHE/kotlin-compiler-embeddable.jar:$CACHE/kotlin-stdlib.jar:$CACHE/kotlin-reflect.jar:$CACHE/kotlin-script-runtime.jar:$CACHE/kotlin-daemon-embeddable.jar:$CACHE/kotlinx-coroutines-core-jvm.jar"

RAW="$CACHE/diagnostics.txt"
# shellcheck disable=SC2046
java -cp "$CP" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
  -no-stdlib -no-reflect \
  -cp "$CACHE/kotlin-stdlib.jar" \
  -d "$CACHE/out" \
  $(find "$SRC" -name '*.kt') > "$RAW" 2>&1

# Everything the missing AndroidX classpath causes, dropped. What remains is
# structural: the file does not parse, or a name is declared twice.
# `conflicting declarations` is what the compiler says for two locals of the
# same name in one scope. It was missing from this list, which is how an
# automated edit that introduced one could pass a run that prints "no
# redeclarations". Both names sit in the same file, so the diagnostic does
# not depend on the classpath that is missing here.
REAL="$(grep -E "error: (syntax error|.*is already defined|conflicting (overloads|declarations)|redeclaration)" "$RAW" || true)"
TOTAL="$(grep -c 'error:' "$RAW" || true)"
UNRESOLVED="$(grep -c 'unresolved reference' "$RAW" || true)"

echo "kotlin-parse: Kotlin $KOTLIN_VERSION, $(find "$SRC" -name '*.kt' | wc -l) files"
echo "  $TOTAL diagnostics, $UNRESOLVED of them unresolved references (no AndroidX on the classpath — expected)"

if [ -n "$REAL" ]; then
  echo
  echo "STRUCTURAL PROBLEMS — these do not depend on the classpath:"
  echo "$REAL"
  exit 1
fi
echo "  no syntax errors, no redeclarations"
echo
echo "This parses. It does not type-check — run ./gradlew compileDebugKotlin for that."
