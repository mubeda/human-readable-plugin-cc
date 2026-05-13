---
description: Rebuild the HTML viewer on every .md or image change (long-running)
argument-hint: '[source-path]'
allowed-tools: Bash(python3:*), Bash(python:*)
---

Run the generator in watch mode from the user's current working directory:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" --watch $ARGUMENTS
```

This is a **long-running process**. The generator will block while it watches the source folder for changes, rebuilding on every `.md` or image edit. Tell the user to stop it with Ctrl-C when done.

**Requirements:**

- `watchdog` Python package. If missing, the generator prints `pip install watchdog` and exits. Surface that instruction to the user — do not install anything automatically.

**Behavior:**

- Performs one initial build, then watches.
- Debounces to one rebuild per 500 ms.
- Watches only files under the configured `source:` folder.
- Honors the same config (`.human-readable.yml`) as `/human-readable:render`.
