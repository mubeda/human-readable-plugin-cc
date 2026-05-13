# human-readable plugin — Technical Specifications

> Version: **0.1.0**
> License: Apache-2.0
> Status: Verified end-to-end on macOS with Python 3.13.

This document is the canonical specification of what the plugin does, how it does it, and the contracts every component honors. Read this when modifying the plugin or auditing its behavior.

---

## 1. Purpose

Render any folder of Markdown documentation into **one self-contained HTML file** that:

- Opens via `file://` on any modern browser, on any OS, with **no network access required**.
- Is portable: a single file you can email, Slack, or zip — no companion assets, no broken paths.
- Looks like a polished editorial documentation site (Fraunces + IBM Plex Sans + JetBrains Mono, warm color palette, light + dark themes).
- Stays in sync as the source folder evolves (idempotent regeneration; optional git hooks; `--watch` mode).
- Works inside any repository under any folder structure (auto-discovery + per-repo `.human-readable.yml` config).

This is a **local-artifact tool**. It is not a static-site generator, not a documentation CMS, and not a build pipeline component. It produces one HTML file you double-click.

---

## 2. Distribution Surface

### 2.1 Marketplace metadata

`.claude-plugin/marketplace.json`:

```json
{
  "name": "human-readable-cc",
  "owner": { "name": "mubeda" },
  "metadata": {
    "description": "Turn any folder of Markdown into a polished, self-contained, offline-portable HTML viewer from inside Claude Code.",
    "version": "0.1.0"
  },
  "plugins": [
    {
      "name": "human-readable",
      "description": "Render a folder of .md files into a single self-contained HTML viewer (Mermaid, KaTeX, PlantUML, GFM, admonitions). Editorial-tech aesthetic, light + dark themes, fully offline.",
      "version": "0.1.0",
      "author": { "name": "mubeda" },
      "source": "./plugins/human-readable"
    }
  ]
}
```

### 2.2 Plugin manifest

`plugins/human-readable/.claude-plugin/plugin.json`:

```json
{
  "name": "human-readable",
  "version": "0.1.0",
  "description": "Render a folder of .md files into a single self-contained HTML viewer (Mermaid, KaTeX, PlantUML, GFM, admonitions). Editorial-tech aesthetic, light + dark themes, fully offline.",
  "author": { "name": "mubeda" }
}
```

### 2.3 Install path resolution

Inside Claude Code, paths resolve via the environment variable `${CLAUDE_PLUGIN_ROOT}`, which Claude Code sets to the plugin's installed location. Commands reference scripts as `${CLAUDE_PLUGIN_ROOT}/scripts/generate.py`.

Outside Claude Code (direct CLI use), the generator's own path is computed at runtime via `Path(__file__).resolve().parent.parent`, which is independent of any environment variable.

---

## 3. Repository Layout

```
human-readable-plugin-cc/
├── .claude-plugin/
│   └── marketplace.json                   # marketplace registration
├── plugins/
│   └── human-readable/
│       ├── .claude-plugin/
│       │   └── plugin.json                # plugin manifest
│       ├── commands/
│       │   ├── render.md                  # /human-readable:render
│       │   └── watch.md                   # /human-readable:watch
│       ├── skills/
│       │   └── human-readable/
│       │       └── SKILL.md               # auto-invoked skill (user-invocable)
│       ├── scripts/
│       │   └── generate.py                # Python generator (single file)
│       ├── assets/
│       │   ├── lib/                       # vendored JS/CSS, version-pinned
│       │   │   ├── marked.min.js              # 12.0.2 — markdown parser
│       │   │   ├── mermaid.min.js             # 10.9.1 — diagrams
│       │   │   ├── katex.min.js               # 0.16.11 — math
│       │   │   ├── katex.min.css              # 0.16.11 — woff2 fonts base64-inlined
│       │   │   ├── katex-auto-render.min.js   # 0.16.11 — $..$ delimiter parser
│       │   │   ├── highlight.min.js           # 11.10.0 — code highlighting
│       │   │   ├── highlight-light.css        # 11.10.0 (github theme)
│       │   │   ├── highlight-dark.css         # 11.10.0 (github-dark theme)
│       │   │   └── fonts/                     # editorial fonts, embedded as base64 at build time
│       │   │       ├── Fraunces-Variable.woff2
│       │   │       ├── Fraunces-Italic-Variable.woff2
│       │   │       ├── IBMPlexSans-Regular.woff2
│       │   │       ├── IBMPlexSans-Italic.woff2
│       │   │       ├── IBMPlexSans-Medium.woff2
│       │   │       ├── IBMPlexSans-SemiBold.woff2
│       │   │       ├── JetBrainsMono-Regular.woff2
│       │   │       └── JetBrainsMono-SemiBold.woff2
│       │   └── template/
│       │       ├── shell.html             # HTML skeleton with placeholders
│       │       ├── styles.css             # 811 lines, editorial-tech CSS
│       │       └── app.js                 # 410 lines, SPA logic
│       └── references/
│           └── usage.md                   # 192 lines, config + troubleshooting
├── README.md                              # install + usage entry point
├── LICENSE                                # Apache-2.0
├── SPECS.md                               # this file
└── .gitignore
```

**Total payload:** ~4.3 MB on disk. Dominated by `mermaid.min.js` (3.3 MB) and `katex.min.css` (367 KB, fonts inlined).

---

## 4. User-Facing Surface

### 4.1 Slash command — `/human-readable:render`

| Frontmatter | Value |
|-------------|-------|
| description | `Render a folder of Markdown into a single self-contained HTML viewer` |
| argument-hint | `[source-path]` |
| allowed-tools | `Bash(python3:*), Bash(python:*)` |

**Body contract:**

1. Runs `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" $ARGUMENTS` from the user's current working directory.
2. Falls back to `python` if `python3` is not on PATH.
3. Reports the final summary line (output path + size) verbatim to the user.
4. On first run in a repo (no `.human-readable.yml`), the generator enters an interactive prompt sequence; the slash-command runner passes user replies through stdin.
5. If the generator hard-fails (e.g., missing `plantuml`), surfaces the install hint verbatim. Does **not** attempt to install anything.

### 4.2 Slash command — `/human-readable:watch`

| Frontmatter | Value |
|-------------|-------|
| description | `Rebuild the HTML viewer on every .md or image change (long-running)` |
| argument-hint | `[source-path]` |
| allowed-tools | `Bash(python3:*), Bash(python:*)` |

**Body contract:**

1. Runs `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" --watch $ARGUMENTS`.
2. Performs one initial build, then watches the source folder for changes.
3. Long-running; the user must stop with `Ctrl-C`.
4. Hard-requires `watchdog` Python package. If missing, generator prints `pip install watchdog` and exits — surface that to the user.

### 4.3 Skill — `human-readable`

`skills/human-readable/SKILL.md` is the auto-invocation hook for Claude. It triggers on natural-language requests such as:

- "Render this docs folder as HTML"
- "Make my markdown human-readable"
- "Generate a docs viewer for this repo"
- "Build a static docs site I can email"
- "/human-readable" (slash-command style)

The skill body documents what the plugin does, when to invoke it, how to run it (slash commands or direct CLI), the config schema, the feature matrix, and the requirements. It points at `references/usage.md` for deep troubleshooting.

---

## 5. Configuration — `.human-readable.yml`

Written at the **target repo root** by the generator on first run. Read on every subsequent run.

```yaml
source: docs/                        # Required. Folder to scan, relative to repo root.
output: ./human-readable.html        # Output path (relative to repo root).
title: null                          # null → auto-derive (git toplevel name → cwd basename).
excludes:                            # fnmatch glob patterns, relative to source root.
  - "**/node_modules/**"
  - "**/.git/**"
  - "CHANGELOG.md"
gitignore_output: true               # Append output path to .gitignore.
hooks_installed: false               # Tracks whether post-merge / post-checkout hooks were installed.
theme_default: light                 # 'light' | 'dark'. Initial value before localStorage override.
```

### 5.1 Schema rules

- `source` and `output` are required. Defaults applied if absent: `docs/` and `./human-readable.html`.
- `title: null` triggers auto-derivation. To force a fixed title, set a string.
- `excludes` are **fnmatch** patterns (not full gitignore syntax). Matched against:
  1. The path relative to `source/`.
  2. The bare filename.
- `gitignore_output: true` causes the generator to append the output path to `.gitignore` on first run only.
- `theme_default` is only consulted when `localStorage['hr-theme']` is unset and `prefers-color-scheme` returns no signal.

### 5.2 Parsing

- If PyYAML is installed → uses `yaml.safe_load`.
- If PyYAML is not installed → falls back to a tiny built-in parser (`parse_simple_yaml`) that handles flat key/value pairs and list-of-strings under one key. Anything more complex requires PyYAML.

---

## 6. The Generator (`scripts/generate.py`)

Single-file Python 3.8+ script, ~700 lines, stdlib-only with two optional deps (`PyYAML`, `watchdog`).

### 6.1 Entry point + arg parsing

```
python3 generate.py [<source-override>] [--watch]
```

- Positional `source` (optional): overrides `.human-readable.yml`'s `source:` for this run only. Does not mutate the config.
- `--watch`: enters file-watcher mode after the initial build.

### 6.2 Pipeline (sequential)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. find_repo_root(cwd)                                              │
│    Walks up from cwd until it finds .git/ or .human-readable.yml.   │
│    Falls back to cwd if neither exists.                             │
├─────────────────────────────────────────────────────────────────────┤
│ 2. load_config(repo_root)                                           │
│    If .human-readable.yml absent and stdin is a TTY:                │
│      → first_run_interactive(repo_root)                             │
│    If absent and non-TTY:                                           │
│      → hard-fail with a message about interactive setup.            │
├─────────────────────────────────────────────────────────────────────┤
│ 3. walk_md_files(source_root, repo_root, excludes)                  │
│    Recursive .md collection. Excludes:                              │
│      - any path with a dot-prefixed component (.git/, .vscode/)     │
│      - any pattern in config.excludes                               │
│      - any pattern read from .gitignore at repo root                │
├─────────────────────────────────────────────────────────────────────┤
│ 4. preflight: has_plantuml(md_files)                                │
│    Scans for ```plantuml fences. If any found and plantuml binary   │
│    not on PATH → hard-fail with install hints, exit 2.              │
├─────────────────────────────────────────────────────────────────────┤
│ 5. per-file processing:                                             │
│    a. parse_frontmatter(text)  — YAML front-matter, leniently       │
│    b. base64_inline_images(body, md_path, source_root)              │
│       - Skips http://, https://, data:                              │
│       - Resolves relative paths against MD file's directory         │
│       - Reads bytes, base64-encodes, replaces with data: URI        │
│    c. render_plantuml(body)                                         │
│       - For each ```plantuml block, pipes source through            │
│         `plantuml -tsvg -pipe`                                      │
│       - Wraps returned SVG in <div class="plantuml-rendered">       │
│       - Strips XML decl from SVG so marked.js can pass it through   │
│    d. extract_title(body, fm, filename)                             │
│       - frontmatter.title → first '# H1' → filename                 │
├─────────────────────────────────────────────────────────────────────┤
│ 6. build_tree(md_files, source_root, content)                       │
│    Nested {type, path, children} dict.                              │
│    Sorted alphabetically. README.md pinned first in its folder.     │
├─────────────────────────────────────────────────────────────────────┤
│ 7. derive_title(repo_root, cfg.title)                               │
│    config → `git rev-parse --show-toplevel` basename → cwd basename │
├─────────────────────────────────────────────────────────────────────┤
│ 8. emit HTML:                                                       │
│    a. read shell.html, styles.css, app.js                           │
│    b. inline 8 woff2 fonts as base64 data URIs in styles.css        │
│    c. read all vendored libs (marked, mermaid, katex, hljs, etc.)   │
│    d. JSON-serialize tree, content, meta (with </script> escaping)  │
│    e. replace {{placeholders}} in shell.html                        │
│    f. atomic write: write to .tmp, then rename                      │
├─────────────────────────────────────────────────────────────────────┤
│ 9. summary line: file count, output path, size in MB                │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 First-run interactive flow

When `.human-readable.yml` is absent and stdin is a TTY:

1. **Discover candidates:**
   - Tries `docs/`, `documentation/`, `wiki/`, `notes/`, `guides/`, `doc/`, `site/` (in order).
   - If none of those contain `.md` files, scans the entire repo and ranks folders by MD-file count (top 3).
   - If no `.md` files exist anywhere → hard-fail.
2. **Prompt for source folder:**
   - Lists candidates with counts.
   - Last option is "type a custom path."
   - Default: option 1.
3. **Prompt for output path** (default `./human-readable.html`).
4. **Prompt for `.gitignore`** (default Yes).
5. **Prompt for git hooks** (default No):
   - If yes → installs `.git/hooks/post-merge` and `.git/hooks/post-checkout`, each a 4-line bash script that re-runs the generator silently.
   - Skips installation for any hook file that already exists.
6. **Write `.human-readable.yml`** with the answers.
7. Continues to step 5 of the pipeline.

### 6.4 Watch mode

Requires `watchdog`. Behavior:

- Performs one initial build (steps 3–8 of the pipeline).
- Registers a `FileSystemEventHandler` watching the `source/` folder recursively.
- Debounces to one rebuild per 500 ms (multi-file save bursts coalesce).
- Triggers a rebuild only for these extensions: `.md`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`.
- Runs until `Ctrl-C`.

### 6.5 Hard-fail conditions

| Condition | Exit code | Recovery |
|-----------|-----------|----------|
| Source folder does not exist | 1 | Fix path in `.human-readable.yml` or pass override |
| No MD files anywhere in repo (first run) | 1 | Add MD files |
| ` ```plantuml ` blocks present + `plantuml` binary missing | 2 | Install plantuml or remove blocks |
| No `.human-readable.yml` + stdin is not a TTY | 1 | Run once interactively or create config by hand |
| `--watch` requested + `watchdog` not installed | 1 | `pip install watchdog` |

The generator **never falls back silently**. Every failure prints a clear instruction.

### 6.6 Helper modules (in-file)

- `parse_simple_yaml(text) → dict` — minimal YAML reader, used when PyYAML absent.
- `load_config(repo_root) → dict | None` — reads + parses config.
- `write_config(repo_root, cfg) → None` — writes config with deterministic key ordering.
- `find_repo_root(start) → Path` — walks up looking for `.git/` or config.
- `derive_title(repo_root, config_title) → str` — three-step resolution.
- `discover_source(repo_root) → list[(Path, int)]` — candidate folders.
- `first_run_interactive(repo_root) → dict` — prompt flow.
- `append_to_gitignore(repo_root, output) → None` — idempotent gitignore append.
- `install_git_hooks(repo_root) → bool` — returns True if at least one hook was installed.
- `matches_any(path, source_root, patterns) → bool` — fnmatch matcher.
- `load_gitignore_patterns(repo_root) → list[str]` — simple gitignore → fnmatch conversion.
- `walk_md_files(source_root, repo_root, excludes) → list[Path]`.
- `parse_frontmatter(text) → (dict, str)`.
- `base64_inline_images(md_text, md_path, source_root) → str`.
- `render_plantuml(md_text) → str` — runs subprocess per block.
- `has_plantuml(md_files) → bool` — preflight scan.
- `build_tree(md_files, source_root, content) → dict`.
- `extract_title(md_body, frontmatter, filename) → str`.
- `inject_into_script(text) → str` — escapes `</script>` → `<\/script>`.
- `build_font_data_uri(filename) → str` — woff2 → `data:font/woff2;base64,...`.

---

## 7. Browser-side App (`assets/template/app.js`)

Single-file vanilla JavaScript IIFE, ~410 lines, no framework, no build step.

### 7.1 Bootstrap

1. Parses three JSON `<script>` blobs at startup:
   - `#hr-tree-data` — directory tree
   - `#hr-content-data` — `{ path: { frontmatter, markdown, title, mtime } }`
   - `#hr-meta-data` — `{ title, theme_default }`
2. Resolves initial theme (see §7.4).
3. Renders the sidebar tree.
4. Reads `location.hash`, dispatches to either landing view or file render.
5. Wires `hashchange`, theme toggle, sidebar toggle, filter input.

### 7.2 Sidebar tree

- Recursive render. Folders open by default (collapse on click).
- Sort: folders first (alphabetical), then files (alphabetical with `README.md` pinned first per folder).
- Selected file gets `.hr-selected` class which renders a 2 px terracotta left bar.
- Filter input (`#hr-filter`):
  - Case-insensitive substring match against the bare filename.
  - On match, all ancestor folders are revealed and expanded.
  - On empty input, all `.hr-tree-hidden` classes are removed.

### 7.3 Markdown rendering pipeline

For each file render:

1. Load `entry.markdown` from `content` blob.
2. `marked.parse(text)` with GFM enabled, custom heading renderer (heading IDs + anchor links), and custom link renderer (rewrites relative `.md` links to in-app `#path` hash routes).
3. `transformAdmonitions(html)` — DOM-level pass that converts `<blockquote><p>[!NOTE]…` into `<div class="hr-admonition" data-kind="note">…</div>` with the kind-marker text replaced by a small icon + label.
4. Inject result into `#hr-article`.
5. `highlight.js` on every `<pre><code>` (except `.language-mermaid` blocks).
6. **Mermaid:** find `<pre><code class="language-mermaid">`, replace with `<div class="mermaid">…</div>`, call `mermaid.run({querySelector: '.hr-article .mermaid'})`.
7. **KaTeX:** call `renderMathInElement(articleEl, {delimiters: …, throwOnError: false})` with delimiters `$..$`, `$$..$$`, `\(..\)`, `\[..\]`.
8. Add `Copy` buttons to every code block.
9. Scroll: if `location.hash` contains a sub-anchor (`#path/to/file.md#section`), scroll to the matching `[id="section"]`. Otherwise scroll the article into view.
10. Update `.hr-tree-file.hr-selected` to mark the current path.

### 7.4 Theme handling

- Storage key: `localStorage['hr-theme']`.
- Initial resolution: `localStorage` → `prefers-color-scheme: dark` media query → `meta.theme_default` from config.
- `applyTheme(t)`:
  - Sets `data-theme` attribute on `<html>`.
  - Toggles `disabled` on `<style id="hl-light">` and `<style id="hl-dark">`.
  - Calls `mermaid.initialize({theme: 'dark' | 'default', ...})` so future Mermaid renders use the right palette.
- Toggle click handler: flips theme, persists to localStorage, calls `applyTheme`, then `renderRoute()` to re-render Mermaid with the new theme.

### 7.5 Routing

- Hash format: `#<path>` or `#<path>#<anchor>`.
- `hashchange` event → `renderRoute()`.
- Empty hash → `renderLanding()`.
- Unknown path → falls back to landing (silent).

### 7.6 Landing view

- If a file named `README.md` exists at the source root → render it as the landing.
- Else: render a generated overview with:
  - File count (Fraunces 40 px number)
  - Folder count
  - "Recently modified" list — top 8 by `mtime`, with ISO-date labels in JetBrains Mono.

---

## 8. HTML Shell (`assets/template/shell.html`)

52-line HTML5 skeleton. Placeholders (replaced by `generate.py`):

| Placeholder | Replaced with |
|-------------|---------------|
| `{{title}}` | derived page title |
| `{{theme_default}}` | `light` or `dark` |
| `{{tree_json}}` | JSON.stringify(tree), with `</script>` escaped |
| `{{content_json}}` | JSON.stringify(content), with `</script>` escaped |
| `{{meta_json}}` | `{title, theme_default}` JSON |
| `{{styles}}` | full `styles.css` (after font inlining) |
| `{{app_js}}` | full `app.js` |
| `{{lib_marked}}` | full `marked.min.js` |
| `{{lib_mermaid}}` | full `mermaid.min.js` |
| `{{lib_katex_js}}` | full `katex.min.js` |
| `{{lib_katex_css}}` | full `katex.min.css` (with fonts already inlined) |
| `{{lib_katex_auto_render}}` | full `katex-auto-render.min.js` |
| `{{lib_highlight_js}}` | full `highlight.min.js` |
| `{{lib_highlight_light}}` | full `highlight-light.css` |
| `{{lib_highlight_dark}}` | full `highlight-dark.css` |
| `{{font_*}}` (×8) | `data:font/woff2;base64,…` for each woff2 |

DOM structure:

```
<html data-theme="{light|dark}">
  <head>
    <style>{katex.css with fonts}</style>
    <style id="hl-light">{highlight light}</style>
    <style id="hl-dark" disabled>{highlight dark}</style>
    <style>{styles.css with fonts}</style>
  </head>
  <body>
    <header class="hr-header">
      [☰] [title]               [breadcrumb] [theme-toggle]
    </header>
    <div class="hr-layout">
      <aside class="hr-sidebar">
        <input id="hr-filter">
        <nav class="hr-tree"></nav>
      </aside>
      <main class="hr-content">
        <article class="hr-article"></article>
      </main>
    </div>
    <script id="hr-tree-data">{...JSON}</script>
    <script id="hr-content-data">{...JSON}</script>
    <script id="hr-meta-data">{...JSON}</script>
    <script>{marked.js}</script>
    <script>{highlight.js}</script>
    <script>{katex.js}</script>
    <script>{katex-auto-render.js}</script>
    <script>{mermaid.js}</script>
    <script>{app.js}</script>
  </body>
</html>
```

---

## 9. Design System (`assets/template/styles.css`)

811 lines. CSS custom properties drive theming; no preprocessor.

### 9.1 Typography

| Role | Font | Weights |
|------|------|---------|
| Display (h1–h4, brand) | **Fraunces** (variable) | 100–900 + italic axis; tuned with `opsz` and `SOFT` variation settings per heading size |
| Body, UI, h5, h6 | **IBM Plex Sans** | 400, 500, 600, 400-italic |
| Code, breadcrumbs, frontmatter labels, numeric stats | **JetBrains Mono** | 400, 600 |
| Fallback chain | system stacks | — |

All fonts are embedded as base64-encoded woff2 inside `styles.css` at build time. The HTML makes **zero network requests** at runtime.

### 9.2 Color tokens (light theme)

| Token | Value | Purpose |
|-------|-------|---------|
| `--hr-bg` | `#FCFBF7` | page background (warm cream) |
| `--hr-bg-soft` | `#F6F3EC` | surface (mermaid containers, code) |
| `--hr-bg-sidebar` | `#F4F0E7` | sidebar background |
| `--hr-bg-code` | `#F2EEE5` | code block bg |
| `--hr-bg-hover` | `#EDE7D9` | hover state |
| `--hr-bg-selected` | `#E5DBC2` | selected file in sidebar |
| `--hr-fg` | `#1A1816` | primary text (warm near-black) |
| `--hr-fg-soft` | `#4D453A` | secondary text |
| `--hr-fg-muted` | `#877E6E` | tertiary text (labels, dates) |
| `--hr-fg-faint` | `#B5AC9A` | quaternary text (markers, dashes) |
| `--hr-rule` | `#E0D9C8` | default border |
| `--hr-rule-soft` | `#EAE3D2` | subtle ruled lines |
| `--hr-accent` | `#B85138` | terracotta (links, highlights, selection bar) |
| `--hr-accent-soft` | `#C76A52` | hover variant |
| `--hr-accent-bg` | `rgba(184, 81, 56, 0.08)` | accent tint |

Admonition colors (note / tip / warning / important / caution) follow the same `--hr-{kind}` + `--hr-{kind}-bg` pattern.

### 9.3 Color tokens (dark theme)

Same tokens, remapped to warm near-black surfaces (`#0F0E0C`, `#181613`, …) and brighter terracotta accent (`#E07854`).

### 9.4 Layout

- Header: 56 px sticky, with `backdrop-filter: blur(8px) saturate(140%)`.
- Sidebar: 288 px fixed width on desktop; full-height fixed slide-in on mobile (≤900 px).
- Content pane: `max-width: 720px`, generous horizontal padding, smooth fade-in animation on every file switch (240 ms cubic-bezier ease-out).

### 9.5 Component specs

- **Admonitions**: thin 2 px colored left bar + uppercase 10.5 px tracked title with icon; subtle 6–8 % bg tint; no boxed fill.
- **Tables**: no full grid; header row in uppercase tracked labels with bottom rule only; alternating zebra rows in subtle warm tint.
- **Code blocks**: rounded 10 px corners, warm surface tint, hover-visible `Copy` button, JetBrains Mono with stylistic alternates.
- **Frontmatter card**: ruled top + bottom, two-column grid (`100px 1fr`), mono lowercase labels.
- **Mermaid + PlantUML containers**: warm soft surface, 12 px rounded corners, generous padding, SVG max-width 100%.
- **Heading anchors**: invisible until heading is hovered; then slides in (`translateX(-3px) → 0`) with terracotta tint.
- **Scrollbars**: webkit-styled, 10 px width, transparent track, tinted thumb that brightens on hover.

### 9.6 Motion

- `hr-article-in` keyframe: `opacity: 0 → 1` + `translateY(6px) → 0` over 240 ms cubic-bezier(0.32, 0.72, 0, 1). Fires on every file switch.
- Sidebar slide-in: same easing, 220 ms.
- Hover transitions: 100–140 ms ease.

---

## 10. Markdown Feature Support

| Feature | Syntax | Where rendered |
|---------|--------|----------------|
| Headings + anchor links | `# H1`–`###### H6` | client-side, marked.js |
| Paragraphs, emphasis, strong | standard | client-side |
| GFM tables | `\| col \| col \|` | client-side |
| Task lists | `- [ ]`, `- [x]` | client-side; checkbox accent set to `--hr-accent` |
| Strikethrough | `~~text~~` | client-side |
| Autolinks | `https://...` | client-side |
| Code blocks | ` ```lang ` | client-side (highlight.js); Mermaid + KaTeX hooks |
| Inline code | `` `code` `` | client-side; styled chip |
| Footnotes | `[^1]` + `[^1]: …` | client-side |
| Admonitions | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]` | client-side DOM transform |
| Math (KaTeX) | `$inline$`, `$$block$$`, `\(...\)`, `\[...\]` | client-side, KaTeX |
| Mermaid | ` ```mermaid ` | client-side, mermaid.js |
| PlantUML | ` ```plantuml ` | **build-time**, `plantuml -tsvg -pipe` → inline SVG |
| Images | `![alt](relative-path.png)` | **build-time**, base64 data URI |
| Internal MD links | `[t](./other.md)` | client-side renderer rewrites to `#path` hash route |
| YAML frontmatter | leading `---\nkey: val\n---` | parsed at build time, shown as metadata card |

External `http(s)://` images are left as-is (will fail in offline contexts, but allows for live remote refs when online).

---

## 11. Behavior Contracts

### 11.1 Idempotence

Running the generator twice against unchanged sources produces **byte-identical output** modulo `mtime` values in the JSON blob. This means:

- Safe to re-run on every save, git hook, or CI step.
- Diffable output if `gitignore_output: false`.

### 11.2 Offline portability

The generated HTML must work with **zero network access**. The generator enforces this by:

- Inlining all JS libraries as `<script>` blocks.
- Inlining all CSS as `<style>` blocks.
- Inlining all woff2 fonts as `data:font/woff2;base64,...` URIs in their respective `@font-face` rules.
- Inlining all images as `data:image/...` URIs.
- Pre-rendering PlantUML at build time (no runtime fetch).

If the user references an external `http(s)://` image, it is left as-is — those will fail offline but the rest of the page still works.

### 11.3 Output filename

Default: `./human-readable.html`. Configurable via `output:`. Atomically written (`.tmp` then rename) to prevent torn writes if interrupted.

### 11.4 Hooks (when installed)

- `.git/hooks/post-merge` and `.git/hooks/post-checkout` are 4-line bash scripts:
  ```bash
  #!/usr/bin/env bash
  # Installed by the human-readable skill.
  set -e
  python "<absolute path to generate.py>" >/dev/null 2>&1 || true
  ```
- Silently no-op on failure (so the hook can't break `git pull`).
- Skip installation for any hook file that already exists.

### 11.5 PlantUML hard requirement

If any MD file in scope contains a ` ```plantuml ` block, the generator **requires** the `plantuml` binary on PATH. There is no online fallback, no client-side renderer, no skip option. The error is intentional — silent fallback would mean offline portability quietly broken.

### 11.6 Theme persistence

- User toggle action: writes `light` or `dark` to `localStorage['hr-theme']`.
- Subsequent loads: that value wins over `prefers-color-scheme` and `theme_default` from config.
- Reset: `localStorage.removeItem('hr-theme'); location.reload()`.

---

## 12. Out of Scope

| Feature | Why excluded |
|---------|--------------|
| Full-text search across MD bodies | Filename filter sufficient for the typical docs-folder size; would add bundle weight |
| Online PlantUML fallback | Conflicts with offline-portability invariant |
| Editing MD from the viewer | This is a reader, not an editor |
| CI/CD deployment helpers | Local-artifact tool |
| Pre-commit hook installation | Couples a generated artifact to source control by default; user can install manually |
| MathJax | KaTeX is faster and cheaper; one math renderer is enough |
| Live-reload server / web component | Adds complexity; the file:// + reload-on-save loop is sufficient |
| Multi-page navigation (browser history beyond hash) | `file://` history works fine via hash routing |
| Per-folder theming | Single theme per HTML; configurable globally |

---

## 13. Dependency Inventory

### 13.1 Runtime dependencies (target user)

| Component | Required | Version | Source |
|-----------|----------|---------|--------|
| Python | yes | 3.8+ | system / Homebrew |
| `plantuml` binary | only if docs use PlantUML | any | Homebrew / apt |
| PyYAML | optional | any | pip |
| watchdog | optional (only `--watch`) | any | pip |

### 13.2 Vendored runtime libraries (bundled in plugin)

| Library | Version | Source | License |
|---------|---------|--------|---------|
| marked.js | 12.0.2 | jsdelivr | MIT |
| mermaid | 10.9.1 | jsdelivr | MIT |
| KaTeX | 0.16.11 | jsdelivr | MIT |
| KaTeX auto-render | 0.16.11 | jsdelivr | MIT |
| highlight.js | 11.10.0 | jsdelivr | BSD-3-Clause |

### 13.3 Vendored fonts (bundled in plugin)

| Font | Source | License |
|------|--------|---------|
| Fraunces (variable + italic-variable) | Google Fonts / Fontsource | OFL-1.1 |
| IBM Plex Sans (regular, italic, medium, semibold) | IBM / Fontsource | OFL-1.1 |
| JetBrains Mono (regular, semibold) | JetBrains / Fontsource | OFL-1.1 |

All vendored assets are version-pinned. To upgrade: re-run the curl commands in the install script (see commit history) and re-test.

---

## 14. Test Coverage (Current State)

End-to-end smoke test exercised against a fixture repo (4 MD files covering tables, frontmatter, code, admonitions, Mermaid, KaTeX) via Chrome DevTools MCP:

| Scenario | Status |
|----------|--------|
| Skill auto-invocation by Claude | ✓ verified (appears in skill list) |
| Generator runs in non-interactive mode (pre-written config) | ✓ |
| Output file is self-contained (move to /tmp, still renders) | ✓ |
| Sidebar tree renders, README-first ordering, filename filter | ✓ |
| Light default + dark toggle + localStorage persistence | ✓ |
| GFM tables, code blocks with highlight.js + Copy buttons | ✓ |
| All 5 admonition kinds with distinct accent colors | ✓ |
| 2 Mermaid diagrams (flowchart + sequence) render | ✓ |
| KaTeX rendering with inlined woff2 fonts | ✓ |
| Theme toggle re-renders Mermaid with new palette | ✓ |
| Zero browser console errors | ✓ |
| `${CLAUDE_PLUGIN_ROOT}` path resolution (plugin layout) | ✓ |

Not yet exercised (logic present, code path inspected only):

- First-run interactive prompts in a fresh repo
- PlantUML rendering with binary present
- PlantUML hard-fail when binary absent
- Image base64 inlining (fixture had no images)
- Git hook installation + auto-rebuild after `git pull`
- `--watch` mode triggers
- Cross-repo run with no `docs/` folder + interactive discovery selection

---

## 15. Versioning Policy

- Semver. Top-level marketplace + per-plugin manifests stay in lock-step.
- Bump rules:
  - **PATCH** (0.1.0 → 0.1.1): bug fix, dependency rev, docs change, CSS-only refinement.
  - **MINOR** (0.1.x → 0.2.0): new feature (e.g., new slash command, new MD feature support).
  - **MAJOR** (0.x.x → 1.0.0): breaking change to config schema, generator CLI, or output filename defaults.

Both `marketplace.json` and `plugin.json` versions are updated atomically per release.

---

## 16. References

- `README.md` — install + usage entry point (user-facing)
- `plugins/human-readable/references/usage.md` — config schema + troubleshooting reference
- `plugins/human-readable/skills/human-readable/SKILL.md` — Claude-auto-invocation hook

