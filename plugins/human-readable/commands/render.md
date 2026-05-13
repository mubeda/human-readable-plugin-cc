---
description: Render a folder of Markdown into a single self-contained HTML viewer
argument-hint: '[source-path]'
allowed-tools: Bash(python3:*), Bash(python:*)
---

Run the generator from the user's current working directory (the target repo):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" $ARGUMENTS
```

If `python3` is not on PATH, retry once with `python`:

```bash
python "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" $ARGUMENTS
```

Report the output path and size from the generator's final summary line to the user verbatim.

**Behavior notes:**

- On first invocation in a repo (no `.human-readable.yml`), the generator runs an interactive first-run flow that asks the user for source folder, output path, `.gitignore` preference, and whether to install `post-merge` / `post-checkout` git hooks. It then writes `.human-readable.yml` at the repo root and runs the build. Pass user replies through stdin as the prompts appear.
- On subsequent invocations, the generator is zero-arg and idempotent.
- Positional `$ARGUMENTS` (if provided by the user) override the configured source path for one run only and do not modify `.human-readable.yml`.
- If the docs contain ` ```plantuml ` blocks and the `plantuml` binary is not on PATH, the generator hard-fails with install instructions (`brew install plantuml` on macOS, `apt install plantuml` on Debian). Surface those instructions to the user as-is — do not attempt to install plantuml automatically.
- The output is one self-contained HTML file (typically 4–6 MB) at `./human-readable.html` (or the configured `output:` path), openable via `file://` with no network required.
