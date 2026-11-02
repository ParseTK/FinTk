#!/usr/bin/env bash
# Fast-forwards one long-lived branch to another, after checking it is safe. Used by the
# "Release: fast-forward" workflow, and testable locally (see GH_BIN below).
#
#   ACTION=release  moves main to dev's tip      (a release)
#   ACTION=sync     moves dev to main's tip      (after something landed on main directly)
#
# A fast-forward adds no commit: afterwards both branches point at the same commit, so dev is never
# "behind" main. It refuses to run unless that is possible, and unless the required checks have
# passed on the exact commit being moved.
#
# Environment:
#   ACTION              release | sync (required)
#   GITHUB_REPOSITORY   owner/name, for the checks API
#   GH_TOKEN            token the gh CLI uses to read check runs
#   REQUIRED_CHECKS     newline-separated check names (defaults below)
#   GH_BIN              gh executable (override in tests)
set -euo pipefail

ACTION="${ACTION:?ACTION must be release or sync}"
GH="${GH_BIN:-gh}"
REQUIRED_CHECKS="${REQUIRED_CHECKS:-frontend
secrets
analyze (javascript-typescript)}"

case "$ACTION" in
  release) FROM=dev;  TO=main ;;
  sync)    FROM=main; TO=dev  ;;
  *) echo "::error::ACTION must be 'release' or 'sync', got '$ACTION'"; exit 2 ;;
esac

git fetch --quiet origin "$FROM" "$TO"
FROM_SHA="$(git rev-parse "origin/$FROM")"
TO_SHA="$(git rev-parse "origin/$TO")"

if [ "$FROM_SHA" = "$TO_SHA" ]; then
  echo "$TO is already at $FROM ($FROM_SHA). Nothing to do."
  exit 0
fi

# 1. Only a true fast-forward: $TO must be an ancestor of $FROM. If $TO has commits of its own,
#    moving it would lose them, so stop and say what to do.
if ! git merge-base --is-ancestor "$TO_SHA" "$FROM_SHA"; then
  echo "::error::$TO has commits that $FROM does not, so it cannot be fast-forwarded to $FROM."
  echo "Bring $TO's commits into $FROM first (for a release, run this workflow with action=sync)."
  exit 1
fi

# 2. Every required check must have succeeded on this exact commit, with none still running.
checks="$("$GH" api "repos/${GITHUB_REPOSITORY}/commits/${FROM_SHA}/check-runs?per_page=100" \
  --jq '.check_runs[] | [.name, .status, (.conclusion // "")] | @tsv')"

failed=0
while IFS= read -r name; do
  [ -z "$name" ] && continue
  verdict="$(printf '%s\n' "$checks" | awk -F'\t' -v n="$name" '
    $1 == n { seen = 1; if ($2 != "completed") pending = 1; else if ($3 == "success") ok = 1 }
    END { if (!seen) print "missing"; else if (pending) print "still running"; else if (ok) print "ok"; else print "not successful" }')"
  if [ "$verdict" = "ok" ]; then
    echo "check '$name': ok"
  else
    echo "::error::required check '$name' on ${FROM_SHA}: $verdict"
    failed=1
  fi
done <<< "$REQUIRED_CHECKS"
if [ "$failed" -ne 0 ]; then
  echo "Refusing to move $TO: not every required check has passed on $FROM_SHA."
  exit 1
fi

# 3. Move it. No --force: the server rejects anything that is not a fast-forward.
git push origin "${FROM_SHA}:refs/heads/${TO}"

summary="Fast-forwarded **$TO** from \`${TO_SHA:0:7}\` to \`${FROM_SHA:0:7}\` (same commit as **$FROM**). \
$(git rev-list --count "${TO_SHA}..${FROM_SHA}") commit(s) moved, no merge commit created."
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$summary" >> "$GITHUB_STEP_SUMMARY"; fi
