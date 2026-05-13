(function () {
  'use strict';

  // ===== data =====
  const tree = JSON.parse(document.getElementById('hr-tree-data').textContent || '{}');
  const content = JSON.parse(document.getElementById('hr-content-data').textContent || '{}');
  const meta = JSON.parse(document.getElementById('hr-meta-data').textContent || '{}');

  // ===== theme =====
  const THEME_KEY = 'hr-theme';
  const themeDefault = meta.theme_default || 'light';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const hlLight = document.getElementById('hl-light');
    const hlDark = document.getElementById('hl-dark');
    if (hlLight) hlLight.disabled = (t === 'dark');
    if (hlDark) hlDark.disabled = (t !== 'dark');
    // Tell mermaid to re-render with the right theme on next render.
    if (window.mermaid && window.mermaid.initialize) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: t === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose'
      });
    }
  }

  function resolveInitialTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return themeDefault;
  }

  applyTheme(resolveInitialTheme());

  document.getElementById('hr-theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    // Re-render current view so mermaid picks up the new theme.
    renderRoute();
  });

  // ===== sidebar tree =====
  const treeEl = document.getElementById('hr-tree');
  const filterInput = document.getElementById('hr-filter');

  function iconFolder() {
    return '<svg class="hr-tree-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/></svg>';
  }
  function iconFile() {
    return '<svg class="hr-tree-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013L10.513 1.573a.25.25 0 0 0-.013-.011z"/></svg>';
  }
  function iconChevron() {
    return '<svg class="hr-tree-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5.22 6.03a.75.75 0 0 1 1.06 0L8 7.75l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0L5.22 7.09a.75.75 0 0 1 0-1.06z"/></svg>';
  }

  // Sort entries: folders first, then files; alphabetical within group; README.md pinned first among files.
  function sortChildren(children) {
    const folders = [];
    const files = [];
    for (const [name, val] of Object.entries(children)) {
      if (val && val.type === 'folder') folders.push([name, val]);
      else files.push([name, val]);
    }
    folders.sort((a, b) => a[0].localeCompare(b[0]));
    files.sort((a, b) => {
      const aReadme = a[0].toLowerCase() === 'readme.md';
      const bReadme = b[0].toLowerCase() === 'readme.md';
      if (aReadme && !bReadme) return -1;
      if (!aReadme && bReadme) return 1;
      return a[0].localeCompare(b[0]);
    });
    return [...folders, ...files];
  }

  function renderTree(node, container, depth) {
    const sorted = sortChildren(node.children || {});
    for (const [name, child] of sorted) {
      if (child.type === 'folder') {
        const folderEl = document.createElement('div');
        folderEl.className = 'hr-tree-folder';
        folderEl.dataset.path = child.path;
        folderEl.dataset.name = name.toLowerCase();
        folderEl.innerHTML = iconChevron() + iconFolder() + '<span>' + escapeHtml(name) + '</span>';
        folderEl.addEventListener('click', (e) => {
          e.stopPropagation();
          folderEl.classList.toggle('hr-collapsed');
        });
        container.appendChild(folderEl);

        const childrenEl = document.createElement('div');
        childrenEl.className = 'hr-tree-children';
        container.appendChild(childrenEl);
        renderTree(child, childrenEl, depth + 1);
      } else {
        const fileEl = document.createElement('a');
        fileEl.className = 'hr-tree-file';
        fileEl.href = '#' + encodeURI(child.path);
        fileEl.dataset.path = child.path;
        fileEl.dataset.name = name.toLowerCase();
        fileEl.innerHTML = iconFile() + '<span>' + escapeHtml(child.title || name) + '</span>';
        container.appendChild(fileEl);
      }
    }
  }

  renderTree(tree, treeEl, 0);

  // Filter
  filterInput.addEventListener('input', () => {
    const q = filterInput.value.trim().toLowerCase();
    if (!q) {
      treeEl.querySelectorAll('.hr-tree-hidden').forEach(el => el.classList.remove('hr-tree-hidden'));
      return;
    }
    treeEl.querySelectorAll('.hr-tree-folder, .hr-tree-file').forEach(el => el.classList.add('hr-tree-hidden'));
    treeEl.querySelectorAll('.hr-tree-children').forEach(el => el.classList.add('hr-tree-hidden'));
    const matches = treeEl.querySelectorAll('.hr-tree-file');
    matches.forEach(el => {
      if (el.dataset.name.includes(q)) {
        el.classList.remove('hr-tree-hidden');
        // Reveal ancestor folders + children containers.
        let cur = el.parentElement;
        while (cur && cur !== treeEl) {
          if (cur.classList.contains('hr-tree-children')) {
            cur.classList.remove('hr-tree-hidden');
            const folder = cur.previousElementSibling;
            if (folder && folder.classList.contains('hr-tree-folder')) {
              folder.classList.remove('hr-tree-hidden');
              folder.classList.remove('hr-collapsed');
            }
          }
          cur = cur.parentElement;
        }
      }
    });
  });

  // ===== marked setup =====
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function slugify(s) {
    return String(s).toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  // Per-render heading-id dedup map. Lives at module scope (not inside the
  // marked-setup block) so renderFile can clear it before each parse — otherwise
  // a second page containing `# Overview` would get id `overview-1`, and theme
  // toggles (which re-render the same page) would keep incrementing.
  const headingSeenIds = new Map();

  if (window.marked) {
    const renderer = new marked.Renderer();

    renderer.heading = function (text, level) {
      let rawText;
      if (typeof text === 'string') rawText = text.replace(/<[^>]+>/g, '');
      else if (text && typeof text === 'object') rawText = text.raw || text.text || '';
      else rawText = String(text || '');
      let id = slugify(rawText);
      const count = headingSeenIds.get(id) || 0;
      headingSeenIds.set(id, count + 1);
      if (count > 0) id = id + '-' + count;
      const inner = typeof text === 'string' ? text : (text.text || rawText);
      return `<h${level} id="${id}">${inner}<a href="#${currentPath}#${id}" class="hr-anchor" aria-hidden="true">#</a></h${level}>`;
    };

    renderer.link = function (href, title, text) {
      if (typeof href === 'object' && href !== null) {
        const tok = href;
        href = tok.href || '';
        title = tok.title || null;
        text = tok.text || (tok.tokens ? marked.parser(tok.tokens) : '');
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      if (!href) return `<a${titleAttr}>${text}</a>`;
      // External / anchor / inline-rendered: pass through.
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('data:')) {
        return `<a href="${escapeHtml(href)}"${titleAttr}${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
      }
      // Resolve relative .md link against currentPath. Split off any
      // `#fragment` so a link like `api.md#auth` still routes internally —
      // resolving the whole thing would produce `dir/api.md#auth`, which is
      // never a key in `content`.
      const hashIdx = href.indexOf('#');
      const pathPart = hashIdx === -1 ? href : href.slice(0, hashIdx);
      const fragment = hashIdx === -1 ? '' : href.slice(hashIdx + 1);
      const resolved = resolveRelative(currentPath, pathPart);
      if (content[resolved]) {
        const frag = fragment ? '#' + fragment : '';
        return `<a href="#${encodeURI(resolved)}${frag}"${titleAttr}>${text}</a>`;
      }
      // Strip .md fragment-only attempts (e.g. ./README.md) when target absent — still render as anchor.
      return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
    };

    marked.use({
      renderer,
      gfm: true,
      breaks: false,
      // Pass through raw HTML (PlantUML SVG blocks are inlined as raw HTML by the generator).
      mangle: false,
      headerIds: false  // we handle IDs in renderer
    });
  }

  function resolveRelative(fromPath, target) {
    if (target.startsWith('/')) return target.replace(/^\/+/, '');
    const fromDir = fromPath.split('/').slice(0, -1);
    const parts = target.split('/');
    for (const p of parts) {
      if (p === '..') fromDir.pop();
      else if (p !== '.' && p !== '') fromDir.push(p);
    }
    return fromDir.join('/');
  }

  // ===== ASCII-diagram detection =====
  // Detects fenced code blocks that look like hand-drawn ASCII diagrams
  // (box-drawing characters, ASCII arrows) so the reader can spot blocks
  // that would render as SVG if they were re-fenced as ```mermaid.
  const ASCII_DIAGRAM_CHARS = /[─-▟▶◀▼▲←-⇿]/;
  const ASCII_ARROW_PATTERN = /(--+>|<--+|<==+|==+>|<->|<-+>)/;
  const ASCII_PLAIN_INFO = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'diagram', 'ascii']);

  function isAsciiDiagramBody(body) {
    const lines = body.split('\n');
    if (lines.length < 3) return false;
    let drawn = 0;
    for (const line of lines) {
      if (ASCII_DIAGRAM_CHARS.test(line)) { drawn++; continue; }
      if (ASCII_ARROW_PATTERN.test(line) && /[|│]/.test(line)) drawn++;
    }
    return drawn >= 2;
  }

  // Normalize and hash a code-block body so the markdown-scanned inventory and
  // the DOM-walked banners agree on a stable id even when their counts diverge
  // (e.g. fences nested inside list items that the scanner doesn't see).
  function normalizeDiagramBody(body) {
    return body.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
  }
  function diagramHash(body) {
    let h = 0x811c9dc5;
    const s = normalizeDiagramBody(body);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function scanMarkdownForAsciiDiagrams(md) {
    // Indent is allowed to grow — fences inside list items are commonly
    // indented 4+ spaces. We don't enforce CommonMark's strict 0–3 rule
    // because false positives are harmless (worklist may list a block the
    // renderer doesn't mark) while false negatives would hide real cases.
    const lines = md.split('\n');
    const results = [];
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)(```+|~~~+)([^\s`]*)\s*(.*)$/);
      if (!m) { i++; continue; }
      const fence = m[2];
      const info = (m[3] || '').trim().toLowerCase();
      const openLine = i;
      i++;
      const bodyStart = i;
      const fenceChar = fence[0];
      while (i < lines.length) {
        const c = lines[i].match(/^\s*(```+|~~~+)\s*$/);
        if (c && c[1][0] === fenceChar && c[1].length >= fence.length) break;
        i++;
      }
      const bodyEnd = i;
      const body = lines.slice(bodyStart, bodyEnd).join('\n');
      if (ASCII_PLAIN_INFO.has(info) && isAsciiDiagramBody(body)) {
        const previewLines = lines.slice(bodyStart, Math.min(bodyEnd, bodyStart + 4));
        results.push({
          lineStart: openLine + 1,
          lineEnd: bodyEnd + 1,
          info,
          preview: previewLines.join('\n'),
          hash: diagramHash(body)
        });
      }
      i = bodyEnd + 1;
    }
    return results;
  }

  function buildAsciiDiagramInventory() {
    const byPath = [];
    for (const [path, entry] of Object.entries(content)) {
      if (!entry || typeof entry.markdown !== 'string') continue;
      const items = scanMarkdownForAsciiDiagrams(entry.markdown);
      if (items.length === 0) continue;
      // Mirror annotateAsciiDiagrams' duplicate-suffix scheme so identical
      // diagrams in the same file get distinct anchors (hash, hash-2, hash-3,
      // …). The scanner emits items in document order, matching the DOM walk.
      const seen = new Map();
      for (const it of items) {
        const n = (seen.get(it.hash) || 0) + 1;
        seen.set(it.hash, n);
        it.anchor = n === 1 ? it.hash : it.hash + '-' + n;
      }
      byPath.push({ path, items });
    }
    byPath.sort((a, b) => a.path.localeCompare(b.path));
    return byPath;
  }

  const asciiInventory = buildAsciiDiagramInventory();
  const asciiTotal = asciiInventory.reduce((n, g) => n + g.items.length, 0);

  function buildAsciiPanel() {
    if (asciiTotal === 0) return;

    // Header badge
    const headerRight = document.querySelector('.hr-header-right');
    const badge = document.createElement('button');
    badge.id = 'hr-ascii-badge';
    badge.className = 'hr-ascii-badge';
    badge.title = 'Open ASCII diagram worklist';
    badge.setAttribute('aria-label', 'Open ASCII diagram worklist');
    badge.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/>' +
      '<rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/>' +
      '<line x1="7" y1="4.5" x2="9" y2="4.5"/><line x1="4.5" y1="7" x2="4.5" y2="9"/>' +
      '</svg>' +
      '<span class="hr-ascii-badge-count">' + asciiTotal + '</span>' +
      '<span class="hr-ascii-badge-label">ASCII diagram' + (asciiTotal === 1 ? '' : 's') + '</span>';
    if (headerRight && headerRight.firstChild) headerRight.insertBefore(badge, headerRight.firstChild);
    else if (headerRight) headerRight.appendChild(badge);

    // Panel
    const panel = document.createElement('aside');
    panel.id = 'hr-ascii-panel';
    panel.className = 'hr-ascii-panel';
    panel.setAttribute('aria-hidden', 'true');
    const headerHtml =
      '<header class="hr-ascii-panel-header">' +
      '<div class="hr-ascii-panel-titlerow">' +
      '<h2>ASCII diagrams</h2>' +
      '<button class="hr-ascii-panel-close" aria-label="Close worklist" title="Close">' +
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>' +
      '</button>' +
      '</div>' +
      '<p class="hr-ascii-panel-help">' +
      '<strong>' + asciiTotal + '</strong> code block' + (asciiTotal === 1 ? '' : 's') + ' across <strong>' + asciiInventory.length + '</strong> file' + (asciiInventory.length === 1 ? '' : 's') +
      ' look like hand-drawn diagrams in plain fences. Rewrite each one in Mermaid syntax (or another diagram language) and fence it as <code>```mermaid</code> to render as SVG — just changing the fence label will not work.' +
      '</p>' +
      '</header>';
    panel.innerHTML = headerHtml + '<div class="hr-ascii-panel-body"></div>';
    document.body.appendChild(panel);

    const body = panel.querySelector('.hr-ascii-panel-body');
    for (const group of asciiInventory) {
      const groupEl = document.createElement('div');
      groupEl.className = 'hr-ascii-group';
      const head = document.createElement('div');
      head.className = 'hr-ascii-group-head';
      head.innerHTML = '<span class="hr-ascii-group-path">' + escapeHtml(group.path) + '</span>' +
                       '<span class="hr-ascii-group-count">' + group.items.length + '</span>';
      groupEl.appendChild(head);
      group.items.forEach((it) => {
        const row = document.createElement('a');
        row.className = 'hr-ascii-item';
        row.href = '#' + encodeURI(group.path) + '#hr-asciidiag-' + it.anchor;
        row.innerHTML =
          '<div class="hr-ascii-item-meta">line ' + it.lineStart + '</div>' +
          '<pre class="hr-ascii-item-preview">' + escapeHtml(it.preview) + '</pre>';
        row.addEventListener('click', () => setAsciiPanelOpen(false));
        groupEl.appendChild(row);
      });
      body.appendChild(groupEl);
    }

    function setAsciiPanelOpen(open) {
      panel.classList.toggle('hr-ascii-panel-open', !!open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      badge.classList.toggle('hr-ascii-badge-active', !!open);
    }
    badge.addEventListener('click', () => setAsciiPanelOpen(!panel.classList.contains('hr-ascii-panel-open')));
    panel.querySelector('.hr-ascii-panel-close').addEventListener('click', () => setAsciiPanelOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('hr-ascii-panel-open')) setAsciiPanelOpen(false);
    });
  }

  buildAsciiPanel();

  // Annotate ASCII diagram fences in the current article. Each banner's id is a
  // content-derived hash so worklist deep-links stay correct even if the
  // markdown scanner and the DOM walker disagree on which blocks they catch.
  function annotateAsciiDiagrams(root) {
    const seen = new Set();
    root.querySelectorAll('pre > code').forEach(code => {
      if (code.classList.contains('language-mermaid')) return;
      const langCls = Array.from(code.classList).find(c => c.indexOf('language-') === 0);
      const lang = langCls ? langCls.slice('language-'.length).toLowerCase() : '';
      if (lang && !ASCII_PLAIN_INFO.has(lang)) return;
      const body = code.textContent;
      if (!isAsciiDiagramBody(body)) return;
      code.classList.add('hr-ascii-diagram');
      const pre = code.parentElement;
      pre.classList.add('hr-ascii-diagram-pre');
      // De-dupe ids when two identical diagrams appear in the same article.
      let id = 'hr-asciidiag-' + diagramHash(body);
      let suffix = 1;
      while (seen.has(id)) { id = 'hr-asciidiag-' + diagramHash(body) + '-' + (++suffix); }
      seen.add(id);
      const banner = document.createElement('div');
      banner.className = 'hr-ascii-banner';
      banner.id = id;
      banner.innerHTML =
        '<span class="hr-ascii-banner-icon" aria-hidden="true">⚠</span>' +
        '<span class="hr-ascii-banner-text">Looks like an ASCII diagram. Rewrite it in Mermaid syntax inside a <code>```mermaid</code> fence to render as SVG — re-fencing the existing ASCII content will not work.</span>';
      pre.parentNode.insertBefore(banner, pre);
    });
  }

  // ===== rendering =====
  const articleEl = document.getElementById('hr-article');
  const breadcrumbEl = document.getElementById('hr-breadcrumb');
  let currentPath = '';

  function transformAdmonitions(html) {
    // GitHub admonitions: <blockquote><p>[!NOTE]...
    // After marked renders, replace these.
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('blockquote').forEach(bq => {
      const firstP = bq.querySelector('p');
      if (!firstP) return;
      const m = firstP.innerHTML.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(<br\s*\/?>)?\s*/i);
      if (!m) return;
      const kind = m[1].toLowerCase();
      firstP.innerHTML = firstP.innerHTML.replace(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(<br\s*\/?>)?\s*/i, '');
      const admo = document.createElement('div');
      admo.className = 'hr-admonition';
      admo.dataset.kind = kind;
      const title = document.createElement('div');
      title.className = 'hr-admonition-title';
      title.innerHTML = iconForKind(kind) + '<span>' + kind + '</span>';
      admo.appendChild(title);
      while (bq.firstChild) admo.appendChild(bq.firstChild);
      bq.replaceWith(admo);
    });
    return tmp.innerHTML;
  }

  function iconForKind(kind) {
    const icons = {
      note: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75zM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>',
      tip: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5zM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75z"/></svg>',
      warning: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0z"/></svg>',
      important: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25zM1.75 1.5a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25zM8 4a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 8 4zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>',
      caution: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>'
    };
    return icons[kind] || icons.note;
  }

  function addCopyButtons(root) {
    root.querySelectorAll('pre > code').forEach(code => {
      const pre = code.parentElement;
      if (pre.querySelector('.hr-copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'hr-copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.innerText);
          btn.textContent = 'Copied';
          btn.classList.add('hr-copied');
          setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('hr-copied'); }, 1500);
        } catch (e) {
          btn.textContent = 'Failed';
        }
      });
      pre.appendChild(btn);
    });
  }

  function renderFrontmatter(fm) {
    if (!fm || Object.keys(fm).length === 0) return '';
    const rows = Object.entries(fm).map(([k, v]) => {
      let val;
      if (Array.isArray(v)) val = v.map(escapeHtml).join(', ');
      else if (v && typeof v === 'object') val = escapeHtml(JSON.stringify(v));
      else val = escapeHtml(v == null ? '' : v);
      return `<div class="hr-frontmatter-row"><span class="hr-frontmatter-key">${escapeHtml(k)}</span><span class="hr-frontmatter-value">${val}</span></div>`;
    }).join('');
    return `<div class="hr-frontmatter">${rows}</div>`;
  }

  function renderFile(path) {
    const entry = content[path];
    if (!entry) {
      articleEl.innerHTML = `<h1>Not found</h1><p>No file at <code>${escapeHtml(path)}</code>.</p>`;
      return;
    }
    currentPath = path;
    breadcrumbEl.textContent = path;
    headingSeenIds.clear();
    let html = window.marked ? marked.parse(entry.markdown) : escapeHtml(entry.markdown);
    html = transformAdmonitions(html);
    articleEl.innerHTML = renderFrontmatter(entry.frontmatter) + html;

    // Annotate ASCII-art "diagrams" in plain fences BEFORE hljs runs — otherwise
    // hljs adds a synthetic language-* class to unlabeled fences and the detector
    // can't tell them apart from real code blocks.
    annotateAsciiDiagrams(articleEl);

    // Highlight.js
    if (window.hljs) {
      articleEl.querySelectorAll('pre code').forEach(el => {
        // Don't highlight mermaid blocks (they have class language-mermaid)
        if (el.classList.contains('language-mermaid')) return;
        // Don't highlight detected ASCII diagrams — auto-detect would falsely
        // color box-drawing characters as scss/csharp tokens.
        if (el.classList.contains('hr-ascii-diagram')) return;
        try { window.hljs.highlightElement(el); } catch (e) { /* ignore */ }
      });
    }
    // Mermaid render
    if (window.mermaid) {
      articleEl.querySelectorAll('pre code.language-mermaid, code.language-mermaid').forEach((el, i) => {
        const code = el.textContent;
        const container = document.createElement('div');
        container.className = 'mermaid';
        container.id = 'hr-mermaid-' + Date.now() + '-' + i;
        container.textContent = code;
        const pre = el.closest('pre');
        if (pre) pre.replaceWith(container);
        else el.replaceWith(container);
      });
      try {
        window.mermaid.run({ querySelector: '.hr-article .mermaid' }).catch(() => {});
      } catch (e) { /* ignore */ }
    }
    // KaTeX render
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(articleEl, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (e) { /* ignore */ }
    }
    addCopyButtons(articleEl);
    // Scroll to anchor if present in hash.
    const hashParts = location.hash.slice(1).split('#');
    if (hashParts.length > 1) {
      const anchor = articleEl.querySelector('[id="' + hashParts[1] + '"]');
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    } else {
      articleEl.scrollIntoView({ block: 'start' });
    }
    // Mark sidebar selection.
    treeEl.querySelectorAll('.hr-tree-file').forEach(el => {
      el.classList.toggle('hr-selected', el.dataset.path === path);
    });
  }

  function renderLanding() {
    breadcrumbEl.textContent = '';
    currentPath = '';
    const rootReadmeKey = Object.keys(content).find(k => /^readme\.md$/i.test(k));
    if (rootReadmeKey) {
      renderFile(rootReadmeKey);
      return;
    }
    // Generated overview.
    const files = Object.entries(content);
    const folders = new Set();
    files.forEach(([p]) => {
      const parts = p.split('/');
      if (parts.length > 1) folders.add(parts.slice(0, -1).join('/'));
    });
    const recent = files
      .map(([p, c]) => ({ path: p, mtime: c.mtime || 0 }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 8);
    let html = `<h1>${escapeHtml(meta.title || 'Documentation')}</h1>`;
    html += '<div class="hr-landing-stats">';
    html += `<div class="hr-landing-stat"><div class="hr-landing-stat-num">${files.length}</div><div class="hr-landing-stat-label">Files</div></div>`;
    html += `<div class="hr-landing-stat"><div class="hr-landing-stat-num">${folders.size}</div><div class="hr-landing-stat-label">Folders</div></div>`;
    html += '</div>';
    html += '<div class="hr-landing-recent"><h2>Recently modified</h2><ul>';
    for (const r of recent) {
      const d = r.mtime ? new Date(r.mtime * 1000).toISOString().slice(0, 10) : '';
      html += `<li><a href="#${encodeURI(r.path)}">${escapeHtml(r.path)}</a><span class="hr-recent-date">${d}</span></li>`;
    }
    html += '</ul></div>';
    articleEl.innerHTML = html;
    treeEl.querySelectorAll('.hr-tree-file').forEach(el => el.classList.remove('hr-selected'));
  }

  function renderRoute() {
    const hash = location.hash.slice(1);
    if (!hash) { renderLanding(); return; }
    const path = decodeURI(hash.split('#')[0]);
    if (content[path]) renderFile(path);
    else renderLanding();
  }

  window.addEventListener('hashchange', renderRoute);
  renderRoute();

  // Sidebar toggle (mobile / collapsible)
  document.getElementById('hr-sidebar-toggle').addEventListener('click', () => {
    document.querySelector('.hr-layout').classList.toggle('hr-sidebar-open');
    document.querySelector('.hr-layout').classList.toggle('hr-sidebar-collapsed');
  });
})();
