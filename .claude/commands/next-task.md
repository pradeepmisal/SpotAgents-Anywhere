---
description: Start every SpotAgents task that is ready, one builder agent per task, in parallel worktrees
---

1. Read `tasks/README.md` and the `status:`/`owner:`/`depends_on:` lines of every `tasks/T*.md`.
2. A task is ready when status is `todo`, owner is a builder agent, and every `depends_on` task is `done`.
3. Pick at most one ready task per owner (builder-backend, builder-web, builder-near). $ARGUMENTS may name specific task ids instead.
4. Spawn them in one message, in parallel, each with `subagent_type` = the owner and `isolation: "worktree"`, prompt: "Do task <id>: tasks/<file>. Follow your agent instructions."
5. List tasks with owner `human` that are now unblocked, with their steps, so I can do them meanwhile.
6. When builders finish, tell me which tasks are in `review` and suggest `/verify-task`.
