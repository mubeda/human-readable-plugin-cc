# human-readable — Usage Reference

Detailed reference for the `human-readable` plugin: config schema, slash commands, CLI flags, and troubleshooting.

## Quick reference

Inside Claude Code (recommended):

```bash
/human-readable:render              # standard run (uses .human-readable.yml from repo root)
/human-readable:render path/to/docs # one-off source override (does not touch config)
/human-readable:watch               # rebuild on .md change (requires watchdog)
```

Outside Claude Code (direct CLI):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py"
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" path/to/docs
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" --watch
```

`${CLAUDE_PLUGIN_ROOT}` is set by Claude Code to the plugin root. Outside Claude Code, substitute the absolute path where the plugin lives.

## Config schema — `.human-readable.yml`

```yaml
source: docs/                        # Required. Folder to scan, relative to repo root.
output: ./human-readable.html        # Output path (relative to repo root).
title: null                          # null -> auto-derive (repo name -> cwd name).
excludes:                            # fnmatch glob patterns, relative to source root.
  - "**/node_modules/**"
  - "**/.git/**"
  - "CHANGELOG.md"
  - "*.draft.md"
gitignore_output: true               # Append output to .gitignore (recommended for local-only artifacts).
hooks_installed: false               # Set by the skill when post-merge / post-checkout hooks are installed.
theme_default: light                 # 'light' or 'dark'. Initial value before any localStorage override.
```

### Excludes — pattern matching

Patterns are matched against the path **relative to the `source` directory** AND against the bare filename:

- `**/node_modules/**` — matches `foo/node_modules/bar/x.md`
- `CHANGELOG.md` — matches any file literally named `CHANGELOG.md` at any depth
- `drafts/*.md` — matches MD files inside the `drafts/` folder one level deep
- `*.draft.md` — matches `notes.draft.md` etc.

The generator also reads patterns from `.gitignore` and excludes those automatically.

## Markdown features

| Feature | Syntax | Rendering |
|---------|--------|-----------|
| Headings + anchors | `# Title` | Auto-linked `#anchor` on hover |
| Tables | GFM pipe tables | Styled, scroll-wraps on overflow |
| Task lists | `- [ ] item` / `- [x] item` | Checkboxes |
| Strikethrough | `~~text~~` | Rendered |
| Code blocks | ` ```lang ` | Highlighted, with Copy button |
| Admonitions | `> [!NOTE]` (also TIP, WARNING, IMPORTANT, CAUTION) | Colored block with icon |
| Math (KaTeX) | `$x^2$` inline, `$$ \int $$` block | Rendered via KaTeX |
| Mermaid | ` ```mermaid ` | Client-side SVG render |
| PlantUML | ` ```plantuml ` | Pre-rendered to inline SVG (build-time) |
| Images | `![alt](path.png)` | Base64-inlined at build time |
| Internal MD links | `[text](./other.md)` | Rewritten to in-app hash routes |

## CLI flags

| Flag | Effect |
|------|--------|
| _(positional)_ | Override source path for this run only. |
| `--watch` | Rebuild on `.md` / image changes. Requires `pip install watchdog`. |
| `--help` | Show usage text. |

## First-run prompts

When you run the generator in a repo that has no `.human-readable.yml`:

1. **Source folder**: discovered candidates listed by MD-file count. Pick one or type a path.
2. **Output path**: defaults to `./human-readable.html`.
3. **gitignore**: append output to `.gitignore`? Recommended **yes** if the HTML is per-user; choose **no** if your team commits the generated HTML.
4. **Hooks**: install `post-merge` + `post-checkout` hooks to auto-rebuild after pulls or branch switches? Choose **yes** for teams whose docs change frequently.

All answers are persisted to `.human-readable.yml` and can be edited anytime.

## Troubleshooting

### `plantuml` not found

If your docs contain ` ```plantuml ` blocks, the generator **hard-fails** with:

```
✗  PlantUML diagrams detected but the `plantuml` binary is missing on PATH.
```

Install it:

| OS | Command |
|----|---------|
| macOS | `brew install plantuml` |
| Debian / Ubuntu | `sudo apt install plantuml` |
| Fedora | `sudo dnf install plantuml` |
| Other | https://plantuml.com/download (requires Java 8+) |

After installation, verify: `which plantuml && plantuml -version`.

### `watchdog` not installed

`--watch` mode requires watchdog:

```bash
pip install watchdog
# or, into a project venv:
python -m pip install watchdog
```

### Removing the hooks

The skill installs `.git/hooks/post-merge` and `.git/hooks/post-checkout`. To remove:

```bash
rm .git/hooks/post-merge .git/hooks/post-checkout
```

Then set `hooks_installed: false` in `.human-readable.yml`.

### Forcing a theme reset

Theme choice is persisted per-browser in `localStorage` under the key `hr-theme`. To reset to the config default, run this in the browser console:

```js
localStorage.removeItem('hr-theme'); location.reload();
```

To change the **default** (the value used when no localStorage and no `prefers-color-scheme` signal), edit `theme_default` in `.human-readable.yml`.

### Output too large

The unconditional library payload (marked + mermaid + katex + highlight.js + KaTeX fonts) is ~4 MB. If your final HTML is much larger than that, the bulk is in `content_json` (your MD bodies + base64 images). Mitigations:

- Move large images out of the docs tree and reference them externally (the generator leaves external `http(s)://` images as-is).
- Add an `excludes:` pattern to skip auto-generated MD (API references, etc.).
- Reduce image size before committing.

### "No .md files found" error

The generator looks for `.md` files in the configured `source` folder. If the message appears:

- Verify `source:` in `.human-readable.yml` points to the right place.
- Run with an explicit override: `python generate.py path/to/docs`.
- Check that files aren't excluded — try temporarily emptying the `excludes:` list.

### MD-to-MD links don't work

The generator rewrites `[text](./other.md)` to in-app routes only if the target file is **inside the scanned source tree**. Links to MD files outside the source folder are left untouched and won't resolve in the viewer.

### Mermaid diagrams blank or broken

- Confirm the fence is exactly ` ```mermaid ` (lowercase, no space).
- Check the browser console — mermaid prints parse errors to it.
- Mermaid bundle is large (~3.3 MB) and parses async; give it a second on first load.

### KaTeX renders wrong / falls back to plain text

- The `$` delimiter is required for inline math; `$$` for block.
- The KaTeX fonts are inlined as base64 in `katex.min.css` — no internet needed.
- If a specific expression fails, KaTeX renders the source in red. Open the browser console for the parse error.

## Committing the HTML vs. keeping it local

| You want… | Set `gitignore_output:` |
|-----------|-------------------------|
| Each developer regenerates locally (default) | `true` |
| The generated HTML is part of the repo and synced via PRs | `false` |

For the committed-HTML workflow, you may also want a **pre-commit** hook that runs the generator before commit. The skill does **not** install pre-commit hooks by default — add it manually if desired.

## Uninstall

To remove the plugin entirely:

```bash
# Inside Claude Code:
/plugin uninstall human-readable@human-readable-cc
/plugin marketplace remove human-readable-cc

# In each repo where you used it:
rm .human-readable.yml human-readable.html
rm .git/hooks/post-merge .git/hooks/post-checkout    # if installed
```

Remove the entry from `.gitignore` if you added one.
