---
name: human-readable
description: Use when the user wants to turn a folder of Markdown documentation into a single polished, self-contained HTML viewer they can open in a browser. Walks the docs folder, renders Markdown (GFM, tables, code highlighting, admonitions), and bakes images plus Mermaid/KaTeX/PlantUML diagrams into one offline-portable file. Triggers on phrases like "render docs", "make docs human-readable", "generate doc viewer", "/human-readable", or any request to convert nested MD into a browsable site.
---

# human-readable — Markdown folder → single polished HTML viewer

## What this skill does

Given any folder tree of `.md` files, generates a **single self-contained HTML file** with:

- Persistent sidebar (collapsible directory tree, `README.md` pinned first per folder, filename filter)
- Content pane that renders Markdown with GFM, tables, syntax-highlighted code, GitHub-style admonitions (`> [!NOTE]`), KaTeX math, Mermaid diagrams, and PlantUML diagrams (pre-rendered to inline SVG)
- Light + dark theme toggle (default light, respects `prefers-color-scheme`, persists in `localStorage`)
- Title auto-derived from `git rev-parse --show-toplevel` or folder name
- Landing view rendering the root `README.md` (or a generated overview if absent)
- Internal `.md → .md` links rewritten for in-app navigation
- Images base64-inlined, libraries inlined → opens via `file://` with **no internet required**

The output is one HTML file (~1–5 MB depending on docs size) you can email, commit, or open by double-clicking.

## When to invoke

Invoke this skill when the user asks any of:

- "Make this docs folder human-readable / browsable / nice-looking"
- "Render my MD into one HTML file"
- "Generate a docs viewer for this repo"
- "Build a static docs site I can email" (single-file portable)
- "/human-readable" (slash-command-style)
- Asking how to share documentation with a teammate who isn't going to clone the repo

## How to run it

The plugin ships a Python generator at `${CLAUDE_PLUGIN_ROOT}/scripts/generate.py` plus two slash commands wrapping it:

```bash
# From the target repo, inside Claude Code:
/human-readable:render              # build with config defaults (interactive on first run)
/human-readable:render docs/        # one-off override of source path
/human-readable:watch               # live-rebuild on .md change (needs: pip install watchdog)

# Or call the script directly (outside Claude Code):
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py"
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" docs/
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" --watch
```

### First run in a new repo (interactive)

1. Checks for `.human-readable.yml` at the repo root. If absent:
   - Auto-discovers candidate source folders (`docs/`, `documentation/`, `wiki/`, `notes/`, `guides/`, else the folder with the most `.md` files).
   - Prompts the user to confirm or pick another.
   - Asks whether to install `post-merge` + `post-checkout` git hooks (auto-rebuild after `git pull` / branch switch).
   - Asks whether to add the output path to `.gitignore` (default: yes — output is a local artifact).
   - Writes `.human-readable.yml` with all answers + sensible defaults.
2. Runs the build.

### Subsequent runs (zero-arg)

1. Loads `.human-readable.yml`.
2. **Preflight:** if any `.md` contains a ` ```plantuml ` block, verifies the `plantuml` binary is on `PATH`. Hard-fails with install instructions otherwise.
3. Walks `source/` honoring `excludes` + `.gitignore`.
4. Per file: parses frontmatter, base64-inlines images, pre-renders PlantUML blocks to SVG.
5. Builds the directory tree (alphabetical, `README.md` first per folder).
6. Resolves the page title (config → git toplevel → cwd basename).
7. Emits the configured output file (default `./human-readable.html`) with all libraries and assets inlined.
8. Prints a summary: file count, output size, output path.

## Config — `.human-readable.yml`

```yaml
source: docs/                        # Folder to scan, relative to repo root
output: ./human-readable.html        # Output path
title: null                          # null -> auto-derive
excludes:                            # Glob patterns relative to source
  - "**/node_modules/**"
  - "**/.git/**"
  - "CHANGELOG.md"
gitignore_output: true               # Append output path to .gitignore if true
hooks_installed: false               # Tracks whether git hooks were installed
theme_default: light                 # 'light' | 'dark' - initial value before localStorage override
```

## Markdown features supported

| Feature | How it works |
|---------|--------------|
| GFM (tables, task lists, strikethrough, autolinks) | `marked.js`, client-side |
| Syntax-highlighted code | `highlight.js` with theme that swaps light/dark |
| Heading anchors | Auto-injected by `marked.js` renderer |
| Internal `.md` links | Rewritten to in-app hash routes |
| Images | Base64-inlined at build time |
| YAML frontmatter | Parsed, shown as metadata card at top of doc |
| Mermaid diagrams | ` ```mermaid ` blocks, rendered client-side |
| KaTeX math | `$inline$` and `$$block$$`, rendered client-side |
| GitHub admonitions | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]` |
| PlantUML | ` ```plantuml ` blocks, pre-rendered to inline SVG at build time |

## Requirements

- **Python 3.8+** (preinstalled on macOS)
- **`plantuml` binary** if your docs use ` ```plantuml ` blocks: `brew install plantuml` (macOS) or `apt install plantuml` (Debian/Ubuntu).
- **PyYAML** (optional, richer frontmatter handling)
- **watchdog** (optional, only for `--watch` mode: `pip install watchdog`)

## Out of scope

- Full-text search across MD bodies (filename filter only).
- Online PlantUML rendering (must use local binary).
- Editing MD from the viewer (read-only).
- CI/CD deployment helpers (local artifact only).
- Pre-commit hook installation (only `post-merge` + `post-checkout`).

## Troubleshooting + advanced config

See `references/usage.md` in this skill directory.
