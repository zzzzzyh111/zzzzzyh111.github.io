# zzzzzyh111.github.io

Personal academic homepage of Yuhang Zhang (章雨航), served by GitHub Pages at <https://zzzzzyh111.github.io/>.

Plain HTML + CSS + a little JavaScript. No build step, no Jekyll (`.nojekyll` is present).

## Structure

```
index.html            # all page content lives here
assets/css/style.css  # design tokens (:root), light/dark themes, layout
assets/js/main.js     # theme toggle, active nav link, live GitHub star counts
assets/img/avatar.svg # placeholder portrait  -> replace with a real photo
assets/img/pub/*.svg  # placeholder thumbnails -> replace with GIFs, one per paper
assets/img/logo/*.svg # placeholder school logos
```

## Editing

- **Add a publication**: copy one `<li class="pub">…</li>` block in `index.html`, edit title / authors / links,
  and point the `<img>` to a new file in `assets/img/pub/`. Add `data-repo="owner/name"` on a Code link to show live stars.
- **Add news**: add one `<li>` at the top of `<ul class="news">`.
- **Swap the portrait**: drop `assets/img/avatar.jpg` in and change the `src` in the hero section.
- **Change colours / background**: edit the tokens at the top of `assets/css/style.css`; the background is the `.bg` layer.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Pushing to `main` deploys automatically.
