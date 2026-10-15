#!/bin/sh
# Publishes the current tree to the public repository, on a branch with its own history
# ("publico"), leaving out what is private: the reference copies of Ink's code and the tests
# that compare against them, and the ad hoc scripts with paths of this machine.
set -e
cd "$(dirname "$0")/.."
MSG="${1:-Sync from private repository}"
WT="$HOME/Projetos/worktrees/tinteiro-publico"
git fetch -q public 2>/dev/null || true
if git show-ref -q --verify refs/heads/publico; then
	git worktree add -q "$WT" publico
else
	git worktree add -q --orphan -b publico "$WT"
fi
trap 'git worktree remove --force "$WT"' EXIT
rsync -a --delete \
	--exclude .git --exclude node_modules --exclude dist --exclude bench/bench.js \
	--exclude tests/reference --exclude tests/equivalence.test.ts \
	--exclude 'bench/t-*.mjs' --exclude bench/deploy-test.sh --exclude scripts/publicar.sh \
	./ "$WT/"
cd "$WT"
if grep -rq "Dale de Silva" --include=*.ts . ; then echo "Ink code found in the public tree; aborting" >&2; exit 1; fi
git add -A
git diff --cached --quiet || git commit -q -m "$MSG"
git push -q public publico:main
echo "Published $(git rev-parse --short HEAD)"
