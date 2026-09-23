# zzzzzyh111.github.io

Personal academic homepage of Yuhang Zhang (章雨航), served by GitHub Pages at <https://yuhangzhang.com/>.

Plain HTML + CSS + a little JavaScript. No build step, no Jekyll (`.nojekyll` is present).

## Structure

```
index.html            # all page content lives here
assets/css/style.css  # design tokens (:root), light/dark themes, layout
assets/js/bg.js       # 3DGS-style point-field background (canvas, no libraries)
assets/js/main.js     # theme toggle, scroll reveal, card tilt, hover video, star counts, back-to-top
assets/css/fonts.css  # self-hosted Inter + Source Serif 4 (no Google Fonts request)
assets/fonts/         # the two variable woff2 files
assets/img/yuhang.jpg # portrait
assets/img/logo/      # school logos
assets/figs/          # one framework figure per paper (WebP, 960px wide)
raw/                  # originals handed over (gitignored, never published)
```

## Editing

- **Add a publication**: copy one `<li class="pub">…</li>` block in `index.html`, edit title / authors / links,
  and point the `<img>` at a new file in `assets/figs/`. Add `data-repo="owner/name"` on a Code link to show live stars.
- **Make a thumbnail**: crop the paper's framework figure, then save it about 960px wide as WebP at quality 86.
- **Add news**: add one `<li>` at the top of `<ul class="news">`. Only the latest three show until the reader expands the list.
- **Visitor map**: the MapMyVisitors widget lives inside `<div class="visitors" id="visitors">` in `index.html`;
  stats at <https://mapmyvisitors.com/web/1c8eq>.
- **Change colours / background**: edit the tokens at the top of `assets/css/style.css`; the background is the `.bg` layer.

## Cache

`index.html` links the stylesheet and scripts with a `?v=<date>` suffix. **Bump that suffix whenever you edit
`style.css`, `fonts.css`, `bg.js` or `main.js`**, otherwise a visitor's browser can pair new HTML with an old
cached stylesheet and the layout breaks. When replacing an image that is already live, rename the file instead
of overwriting it, for the same reason.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Pushing to `main` deploys automatically.
