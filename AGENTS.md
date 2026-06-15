# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.

## Codex Desktop / MiMo Stability Rules

This workspace is often run through the MiMo `mimo-v2.5-pro` third-party gateway. Keep Codex context small and predictable:

- Do not print full HTML, full API JSON payloads, build logs, lockfiles, generated files, or large command output into the chat.
- For curl/API checks, print only HTTP status, endpoint, and at most the first 800 characters of a response body.
- For logs, use `tail -80` or less, and summarize repeated lines instead of dumping the whole file.
- Before reading many files, use `.wolf/anatomy.md`, `rg`, or targeted line ranges. Avoid broad full-file reads.
- When a task has run for a long time or the conversation starts failing with a model/API error, start a new Codex task or compact the context before continuing.
- Prefer concise verification commands such as `curl -s -o NUL -w "%{http_code}" ...` on Windows or `curl -s -o /dev/null -w "%{http_code}" ...` in bash.


<claude-mem-context>
# Memory Context

# claude-mem status

This project has no memory yet. The current session will seed it; subsequent sessions will receive auto-injected context for relevant past work.

Memory injection starts on your second session in a project.

`/learn-codebase` is available if the user wants to front-load the entire repo into memory in a single pass (~5 minutes on a typical repo, optional). Otherwise memory builds passively as work happens.

Live activity: http://localhost:37777
How it works: `/how-it-works`

This message disappears once the first observation lands.
</claude-mem-context>