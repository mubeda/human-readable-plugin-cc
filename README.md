# human-readable plugin for Claude Code

Turn any folder of Markdown into a **single self-contained HTML viewer** — polished, offline-portable, openable by double-clicking. Works inside any repo from Claude Code.

Rendering you get out of the box:

- GitHub-Flavored Markdown (tables, task lists, strikethrough, autolinks)
- Syntax-highlighted code blocks (with copy buttons)
- GitHub-style admonitions: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`
- KaTeX math (`$x^2$` inline, `$$\int$$` block)
- Mermaid diagrams (rendered client-side)
- PlantUML diagrams (pre-rendered to inline SVG at build time)
- Images base64-inlined → no broken references when the file is moved or emailed
- Internal `.md` → `.md` links auto-rewritten for in-app navigation
- Editorial-tech aesthetic: Fraunces serif headings, IBM Plex Sans body, JetBrains Mono code, warm terracotta accent. Light + dark themes with system-pref detection and `localStorage` persistence.

## Requirements

- **Python 3.8+** (preinstalled on macOS)
- **`plantuml` binary** _only if_ your docs contain ` ```plantuml ` blocks: `brew install plantuml` (macOS) or `sudo apt install plantuml` (Debian/Ubuntu). Hard requirement when used — there's no online fallback.
- **PyYAML** (optional, for richer frontmatter handling — graceful fallback if missing)
- **watchdog** (optional, only for `/human-readable:watch`: `pip install watchdog`)

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add mubeda/human-readable-plugin-cc
```

Install the plugin:

```bash
/plugin install human-readable@human-readable-cc
```

Reload plugins:

```bash
/reload-plugins
```

After install you should see:

- the slash commands listed below (`/human-readable:render`, `/human-readable:watch`)
- the `human-readable` skill in the skills list

### Updating an installed version

```bash
/plugin marketplace update human-readable-cc
/plugin update human-readable@human-readable-cc
/reload-plugins
```

## Usage

### `/human-readable:render`

Generate (or regenerate) the HTML viewer for the docs folder in the current repo.

```bash
/human-readable:render              # standard run, reads .human-readable.yml
/human-readable:render docs/        # one-off source override (does not touch config)
/human-readable:render guides/api   # explicit subfolder
```

**First run in a new repo** (no `.human-readable.yml`) is interactive:

1. Auto-discovers candidate source folders (`docs/`, `documentation/`, `wiki/`, `notes/`, `guides/`, else the folder with the most `.md` files) and lists them.
2. Asks you to pick or type a path.
3. Asks whether to append the output path to `.gitignore` (default **yes** — the output is a local artifact).
4. Asks whether to install `post-merge` + `post-checkout` git hooks (auto-rebuild after `git pull` or branch switch).
5. Writes `.human-readable.yml` with all answers.
6. Runs the build.

**Subsequent runs** are zero-arg. The build is idempotent — re-running with no source changes produces identical bytes.

Output defaults to `./human-readable.html` at the repo root. Open it with `open ./human-readable.html` (macOS) or your file explorer.

### `/human-readable:watch`

Long-running watch mode: rebuilds whenever you save a `.md` or referenced image. Requires `pip install watchdog`.

```bash
/human-readable:watch
```

Stop with `Ctrl-C`.

## Config — `.human-readable.yml`

Written at repo root on first run, edit freely:

```yaml
source: docs/                        # Folder to scan, relative to repo root
output: ./human-readable.html        # Output path
title: null                          # null → auto-derive from git toplevel / cwd
excludes:                            # fnmatch patterns relative to source root
  - "**/node_modules/**"
  - "**/.git/**"
  - "CHANGELOG.md"
gitignore_output: true               # Append output to .gitignore (recommended)
hooks_installed: false               # Tracks whether git hooks were installed
theme_default: light                 # 'light' | 'dark'
```

## How it works

1. **Walk:** recursively collect `.md` files under `source/`, honoring `excludes` + `.gitignore`.
2. **Per file:** parse YAML frontmatter; base64-inline referenced images; pre-render ` ```plantuml ` blocks to inline SVG via the local `plantuml` binary; leave Mermaid / KaTeX / admonitions / code blocks untouched.
3. **Tree:** build a sorted directory tree (folders alphabetical, `README.md` pinned first per folder).
4. **Title:** resolve from config → `git rev-parse --show-toplevel` basename → cwd basename.
5. **Emit:** load the HTML shell template; inline all libraries (marked.js, mermaid, KaTeX with embedded woff2 fonts, highlight.js, custom fonts: Fraunces, IBM Plex Sans, JetBrains Mono), styles, app JS, and the tree + content JSON blobs. Write atomically to the configured output path.
6. The resulting HTML is fully offline — no CDN, no font hosting, no network. Move it anywhere; it still renders.

## Aesthetic

This plugin is opinionated about typography. Out of the box:

- **Display (headings):** [Fraunces](https://fonts.google.com/specimen/Fraunces) variable — distinctive editorial serif with optical-size and soft-axis tuning per heading.
- **Body (UI + prose):** [IBM Plex Sans](https://github.com/IBM/plex) — humanist tech-editorial sans.
- **Code:** [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — with stylistic alternates.
- **Color:** warm cream / near-black backgrounds, terracotta accent. Light theme default; toggle persists per browser.

Inspired by Stripe / Linear / Mintlify docs — designed for sustained reading, not generic SaaS dashboards.

## What's out of scope

- Full-text search across MD bodies (filename filter only)
- Online PlantUML rendering (local binary required)
- Editing MD from the viewer (read-only)
- CI/CD deployment helpers (this is a local-artifact tool)
- Pre-commit hook installation (only `post-merge` + `post-checkout`)

## Files

```
plugins/human-readable/
├── .claude-plugin/plugin.json
├── commands/
│   ├── render.md           # /human-readable:render
│   └── watch.md            # /human-readable:watch
├── skills/human-readable/
│   └── SKILL.md            # invoked by Claude when user asks for docs viewer
├── scripts/
│   └── generate.py         # the Python generator
├── assets/
│   ├── lib/                # vendored, version-pinned, inlined at build time
│   │   ├── marked.min.js
│   │   ├── mermaid.min.js
│   │   ├── katex.min.{js,css}  (KaTeX woff2 fonts already base64-inlined in css)
│   │   ├── katex-auto-render.min.js
│   │   ├── highlight.min.js + highlight-{light,dark}.css
│   │   └── fonts/          # Fraunces, IBM Plex Sans, JetBrains Mono (woff2)
│   └── template/
│       ├── shell.html      # HTML skeleton with placeholders
│       ├── styles.css      # editorial-tech CSS
│       └── app.js          # SPA logic
└── references/
    └── usage.md            # full config + troubleshooting reference
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
