# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.

## Claude Code Desktop / Third-Party Gateway Stability Rules

This workspace may run through different Claude Code Desktop third-party gateway profiles, such as DeepSeek, MiMo, or Kimi. Before naming the active model or provider, inspect the current gateway config or ask the user. Do not assume MiMo is active unless the applied config is the MiMo profile.

Keep Claude Code context small and predictable:

- Do not print full HTML, full API JSON payloads, build logs, lockfiles, generated files, or large command output into the chat.
- For curl/API checks, print only HTTP status, endpoint, and at most the first 800 characters of a response body.
- For logs, use `tail -80` or less, and summarize repeated lines instead of dumping the whole file.
- Before reading many files, use `.wolf/anatomy.md`, `rg`, or targeted line ranges. Avoid broad full-file reads.
- When a task has run for a long time or the conversation starts failing with a model/API error, start a new Claude Code task or compact the context before continuing.
- Prefer concise verification commands such as `curl -s -o NUL -w "%{http_code}" ...` on Windows or `curl -s -o /dev/null -w "%{http_code}" ...` in bash.
