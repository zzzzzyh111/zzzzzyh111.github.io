# zzzzzyh111.github.io

Personal academic homepage of Yuhang Zhang (章雨航), served by GitHub Pages at <https://zzzzzyh111.github.io/>.

Plain HTML + CSS + a little JavaScript. No build step, no Jekyll (`.nojekyll` is present).

## Structure

```
index.html            # all page content lives here
assets/css/style.css  # design tokens (:root), light/dark themes, layout
assets/js/main.js     # theme toggle, active nav link, live GitHub star counts
assets/css/fonts.css  # self-hosted Inter + Source Serif 4 (no Google Fonts request)
assets/fonts/         # the two variable woff2 files
assets/img/yuhang.jpg # portrait
assets/img/logo/      # school logos
assets/media/         # one 12 s muted MP4 + poster JPG per paper (thumbnail "GIFs")
raw/                  # originals handed over (gitignored, never published)
```

## Editing

- **Add a publication**: copy one `<li class="pub">…</li>` block in `index.html`, edit title / authors / links,
  and point the `<video>` poster/source to new files in `assets/media/`. Add `data-repo="owner/name"` on a Code link to show live stars.
- **Make a thumbnail clip**: `ffmpeg -ss <start> -t 12 -i video.mp4 -vf "fps=15,scale=480:-2,format=yuv420p" -c:v libx264 -crf 26 -an assets/media/<slug>.mp4`
  then `ffmpeg -i assets/media/<slug>.mp4 -frames:v 1 -q:v 4 assets/media/<slug>.jpg` for the poster.
- **Add news**: add one `<li>` at the top of `<ul class="news">`.
- **Change colours / background**: edit the tokens at the top of `assets/css/style.css`; the background is the `.bg` layer.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Pushing to `main` deploys automatically.
