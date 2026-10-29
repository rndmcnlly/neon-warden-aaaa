#!/usr/bin/env bash
# Build the public mirror of this repository: the real history, rewritten.
#
#   scripts/publish_mirror.sh [DEST]     # default ~/Desktop/neon-warden-public
#
# Re-runnable: DEST is rebuilt from scratch each time (only if it is absent or
# a mirror this script made earlier). It never pushes, creates a GitHub
# repository or deploys; publishing is a separate, human decision.
#
# What it does, on a fresh clone of the committed main branch (uncommitted
# work in the source checkout is never included):
#   1. git filter-repo, across ALL history:
#      - drops third-party game screenshots, composites embedding them and a
#        scanned manual page (research/2026-10-29-public-repo-audit, section 4);
#      - drops every video file under research/ (QA evidence, about 200 MB);
#      - rewrites machine-local paths and private names (--replace-text).
#   2. adds one commit: a REMOVED.md stub in each emptied folder and
#      docs/COMMIT-MAP.tsv (old private hash -> new public hash, for the
#      hashes cited in docs).
#   3. verifies: no blob over 10 MB, no private patterns in any blob, no
#      removed path or video in any commit, gitleaks clean, and a fresh
#      checkout passes `deno task ci`. Prints commit count and size.
#
# Needs: git, uv (for `uvx git-filter-repo`), curl, deno, rg. gitleaks is used
# from PATH or downloaded once into a cache folder; nothing is installed.
#
# The patterns below are written so this file does not match itself: a
# character class like `/User[s]/` matches the private text but the file's
# own bytes do not contain it, so the scan stays clean on the mirror's copy
# of this script.

set -euo pipefail

SRC=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
DEST=${1:-${NW_PUBLIC_DIR:-$HOME/Desktop/neon-warden-public}}
GITLEAKS_VERSION=8.28.0
CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/neon-warden-publish
MARKER=.git/neon-warden-public-mirror
MAX_BLOB=$((10 * 1024 * 1024))

# Third-party material, removed from every commit (paths at any revision).
REMOVE_PATHS=(
  research/2026-10-28-critique-visual/comparators/
  research/2026-10-28-critique-visual/side/
  research/2026-10-28-level-design/comparators/
  research/2026-10-28-level-design/side/
  research/2026-10-28-critique-ui/comparators/
  research/2026-10-28-critique-ui/compare/
  research/2026-10-28-control-feel/manual-controls-page6.png
)
VIDEO_REGEX='^research/.*\.(mp4|webm|mov|mkv|m4v|avi)$'

# Private-text patterns for the scan (ripgrep regex, self-safe).
SCAN_PATTERNS=(
  '/User[s]/'
  '/var/folder[s]/'
  '[A-Za-z0-9-]+\.[A-Za-z0-9-]+\.ts\.ne[t]\b'
  'darknu[t]'
  'CMPM 121-f2[6]'
)

say() { printf '\n== %s\n' "$*"; }
fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

# -- 0. fresh destination

if [ -e "$DEST" ]; then
  [ -f "$DEST/$MARKER" ] || fail "$DEST exists and is not a mirror made by this script"
  rm -rf "$DEST"
fi
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

say "clone $SRC (main) -> $DEST"
git clone --quiet --no-local --single-branch --branch main "$SRC" "$DEST"
touch "$DEST/$MARKER"
cd "$DEST"
SRC_HEAD=$(git rev-parse --short HEAD)

# Remember what the stubs should list before the files disappear.
for p in "${REMOVE_PATHS[@]}"; do
  case "$p" in
  */) git log --all --format= --name-only -- "$p" | sort -u >"$WORK/$(echo "$p" | tr / _).list" ;;
  esac
done

# -- 1. filter-repo

cat >"$WORK/replace.txt" <<'EOF'
regex:/User[s]/[A-Za-z0-9._-]+/Desktop/neon-warden-aaaa/==>
regex:/User[s]/[A-Za-z0-9._-]+/Desktop/neon-warden-aaaa\b==>.
regex:/var/folder[s]/[A-Za-z0-9_]+/[A-Za-z0-9_]+/T\b==>$TMPDIR
regex:/User[s]/[A-Za-z0-9._-]+==>~
regex:~/Desktop/CMPM 121-f2[6]/?==>(private course workspace)/
regex:CMPM 121-f2[6]==>private course workspace
regex:private course repo with grading and student\s+research folders==>private course workspace
regex:[A-Za-z0-9-]+\.[A-Za-z0-9-]+\.ts\.ne[t]\b==>example.ts.net
regex:darknu[t]==>[host]
EOF

args=(--force --invert-paths --path-regex "$VIDEO_REGEX" --replace-text "$WORK/replace.txt")
for p in "${REMOVE_PATHS[@]}"; do args+=(--path "$p"); done
say "git filter-repo"
uvx git-filter-repo "${args[@]}"

# -- 2. publication commit: stubs and the hash map

for p in "${REMOVE_PATHS[@]}"; do
  case "$p" in
  */)
    list="$WORK/$(echo "$p" | tr / _).list"
    mkdir -p "$p"
    {
      echo "# Removed from the public repository"
      echo
      echo "This folder held third-party game screenshots (or composites embedding"
      echo "them) used for internal visual critique. They are not ours to"
      echo "redistribute, so they were removed from every commit of the public"
      echo "history. The fetch or compose scripts in \`../scripts/\` show where they"
      echo "came from; the README in the parent folder records what we learned."
      echo
      echo "Files that were here:"
      echo
      sed 's|.*/|- |' "$list"
    } >"$p/REMOVED.md"
    ;;
  *)
    {
      echo "# Removed from the public repository"
      echo
      echo "\`$(basename "$p")\` (a scanned page of a commercial game manual) was"
      echo "removed from every commit of the public history. The surrounding notes"
      echo "cite the source."
    } >"$(dirname "$p")/REMOVED-$(basename "$p").md"
    ;;
  esac
done
{
  printf 'old\tnew\n'
  # filter-repo's map: old new, full hashes; keep the short forms docs cite.
  tail -n +2 .git/filter-repo/commit-map | awk '{ printf "%s\t%s\n", substr($1,1,7), substr($2,1,7) }'
} >docs/COMMIT-MAP.tsv
git add -A research docs/COMMIT-MAP.tsv
git -c user.name="$(git -C "$SRC" config user.name)" \
  -c user.email="$(git -C "$SRC" config user.email)" \
  commit --quiet -m "Publication: stubs for removed third-party media, private-to-public commit map

Built by scripts/publish_mirror.sh from private main at $SRC_HEAD."

git reflog expire --expire=now --all
git gc --quiet --prune=now

# -- 3. verify

say "verify: largest blob"
largest=$(git rev-list --objects --all |
  git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' |
  awk '$1 == "blob"' | sort -k2 -n | tail -1)
echo "$largest"
[ "$(echo "$largest" | awk '{print $2}')" -lt "$MAX_BLOB" ] || fail "blob over 10 MB"

say "verify: removed paths and videos absent from every commit"
git rev-list --objects --all | awk 'NF > 1 { $1 = ""; print substr($0, 2) }' | sort -u >"$WORK/paths"
bad=$(grep -E "$VIDEO_REGEX" "$WORK/paths" || true)
for p in "${REMOVE_PATHS[@]}"; do
  bad+=$(grep -F "$p" "$WORK/paths" | grep -v 'REMOVED' || true)
done
[ -z "$bad" ] || fail "still present: $bad"
echo "ok"

say "verify: private patterns in any blob"
git cat-file --batch-all-objects --batch-check='%(objectname) %(objecttype)' |
  awk '$2 == "blob" { print $1 }' >"$WORK/blobs"
hits=0
for pat in "${SCAN_PATTERNS[@]}"; do
  n=$(git cat-file --batch <"$WORK/blobs" | rg -a -c -e "$pat" || true)
  printf '  %-45s %s\n' "$pat" "${n:-0}"
  hits=$((hits + ${n:-0}))
done
[ "$hits" -eq 0 ] || fail "$hits private-pattern line(s) remain"

say "verify: gitleaks"
GITLEAKS=$(command -v gitleaks || true)
if [ -z "$GITLEAKS" ]; then
  GITLEAKS="$CACHE/gitleaks-$GITLEAKS_VERSION"
  if [ ! -x "$GITLEAKS" ]; then
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)
    [ "$arch" = aarch64 ] && arch=arm64
    [ "$arch" = x86_64 ] && arch=x64
    mkdir -p "$CACHE"
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v$GITLEAKS_VERSION/gitleaks_${GITLEAKS_VERSION}_${os}_${arch}.tar.gz" |
      tar -xz -C "$WORK" gitleaks
    mv "$WORK/gitleaks" "$GITLEAKS"
  fi
fi
"$GITLEAKS" git --redact --no-banner . || fail "gitleaks found leaks"

say "verify: fresh checkout passes deno task ci"
git clone --quiet "$DEST" "$WORK/ci"
(cd "$WORK/ci" && deno task ci >"$WORK/ci.log" 2>&1) || {
  tail -30 "$WORK/ci.log"
  fail "deno task ci failed in a fresh checkout"
}
echo "ok"

say "result"
echo "mirror:  $DEST (from private main $SRC_HEAD; no remote configured)"
echo "commits: $(git rev-list --count HEAD)"
git count-objects -vH | grep -E 'size-pack|count|in-pack'
du -sh .git
