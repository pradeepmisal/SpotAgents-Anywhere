---
description: Run the reviewer on SpotAgents tasks in review, then merge the ones that pass
---

1. Find tasks with `status: review` (or the ids in $ARGUMENTS).
2. Spawn one `reviewer` agent per task in parallel, each pointed at the task file and its worktree branch.
3. For each task the reviewer marks `done`, merge its branch into `main` locally (no push) and report conflicts instead of resolving them blindly.
4. For tasks sent back to `doing`, show the fix list and offer to re-run the owner builder on it.
