# Sargam — Hindi & Punjabi Music Site

A Spotify-style music site built on the **free iTunes India API**.
No API key. No signup. No backend. No payment. Ever.

---

## What's in this folder

```
sargam-music-site/
├── index.html                        ← the whole app (open this)
├── README.md                         ← this file
├── COPY-PASTE-CODE.txt               ← same app as plain text, for pasting
└── extras/
    ├── itunes-india-simple.html      ← a simpler 1-page version
    ├── music-api.js                  ← reusable JS functions for the API
    └── ITUNES-INDIA-EASY-GUIDE.md    ← step-by-step beginner guide
```

Everything runs from `index.html`. Nothing else is required.

---

## How to run it (30 seconds)

1. Unzip the folder anywhere on your Mac
2. Double-click **`index.html`**
3. It opens in your browser and loads real Hindi/Punjabi charts

That's it. No installation, no terminal, no server.

---

## How to put it on the internet (free)

**Netlify Drop** (easiest — no account needed to start)
1. Go to `app.netlify.com/drop`
2. Drag the whole `sargam-music-site` folder onto the page
3. You get a live URL instantly

**GitHub Pages**
1. Create a repo, upload `index.html`
2. Settings → Pages → Source: `main` branch → Save
3. Live at `https://yourname.github.io/repo-name`

**Vercel**
1. `vercel.com` → New Project → drag the folder
2. Deploy

All three are free. Because there's no backend, any static host works.

---

## What it does

| Feature | How |
|---|---|
| Top Punjabi / Bollywood / India charts | Apple's keyless chart RSS + `/lookup` for previews |
| Search any song or artist | `itunes.apple.com/search?country=in` |
| 30-second previews | Apple's `previewUrl` MP3/M4A files |
| Full song playback | Official Apple Music embed (legal, free) |
| Liked songs | Saved in the browser's `localStorage` |
| Shuffle / repeat / volume / seek | Plain JavaScript |
| Keyboard shortcuts | `Space` = play/pause, `Shift + ←/→` = prev/next |

Works for Hindi, Punjabi, Tamil, Telugu, Sufi, Devotional and everything else in the
Indian iTunes catalogue. Also accepts Devanagari and Gurmukhi search terms.

---

## The API it uses (all free, all keyless)

```
Search        https://itunes.apple.com/search?term=NAME&entity=song&limit=30&country=in
Charts        https://itunes.apple.com/in/rss/topsongs/limit=25/json
Punjabi chart https://itunes.apple.com/in/rss/topsongs/limit=25/genre=100033/json
Bollywood     https://itunes.apple.com/in/rss/topsongs/limit=25/genre=1263/json
Details       https://itunes.apple.com/lookup?id=ID1,ID2,ID3&country=in
Full song     https://embed.music.apple.com/in/album/{collectionId}?i={trackId}
```

`country=in` is mandatory — without it you get the American catalogue and Hindi/Punjabi
results mostly disappear.

---

## Rules to stay working (it's a free shared service)

- Wait ~380 ms after typing before searching (already done in the code)
- Results are cached for 10 minutes (already done)
- Batch chart IDs into one `/lookup` call (already done)
- Don't download the audio files — streaming only
- Keep `limit` at 25–30 for a website

Apple allows roughly **20 requests per minute**. The app stays well under that.

---

## Customising

Open `index.html` in any text editor (VS Code, Sublime, even TextEdit in plain-text mode).

**Change the colours** — edit the top of the `<style>` block:

```css
:root{
  --amber:#f5a524;      /* main accent */
  --rose:#f43f5e;       /* secondary accent */
  --grad:linear-gradient(135deg,#f5a524 0%,#f97362 55%,#f43f5e 100%);
  --ink:#08070c;        /* page background */
}
```

**Change the name** — search for `Sargam` and replace it.

**Add another chart** — copy any `<button class="nav-item" data-view="chart" data-genre="...">`
line in the sidebar and change the genre number:

| Genre | ID | Genre | ID |
|---|---|---|---|
| Punjabi Pop | 100033 | Sufi | 1268 |
| Punjabi | 100045 | Devotional | 1267 |
| Bollywood | 1263 | Indian Pop | 1185 |
| Tamil | 1264 | Haryanvi | 100041 |
| Telugu | 1265 | Bhojpuri | 100040 |

Then add its name to the `GENRES` object in the `<script>`.

---

## Troubleshooting

**"Could not load chart"**
You're probably viewing it inside a chat preview pane, which blocks internet access.
Download the folder and double-click `index.html` instead.

**The page is blank**
The file isn't named `index.html`. On Mac, check Finder → View → Show All Filename
Extensions. If it says `index.html.txt`, rename it.

**Search returns English songs**
`country=in` is missing from the URL. Check the `apiSearch` function.

**No sound**
Some tracks have no preview. The app skips those automatically.
Also check the volume slider and that the tab isn't muted.

**Images are blurry**
Make sure the code still has `.replace('100x100bb', '600x600bb')`.

---

## Honest limits

- **30-second previews only.** That's what the free API returns.
- **No full-length audio files.** Hindi/Punjabi rights belong to T-Series, Sony Music India,
  Saregama and others. The "Full song" button opens Apple's official player instead, which
  is legal and free for you.
- **No downloads.** Downloading previews isn't permitted.
- **No user accounts / playlists in the cloud.** Likes are stored in the visitor's browser.

For a fully legal site with no takedown risk, that's the right shape.

---

## Credits

Unofficial project. Not affiliated with or endorsed by Apple.
Song data, artwork and previews are provided by the public iTunes Search API.
"Apple Music" is a trademark of Apple Inc.

Built with plain HTML, CSS and JavaScript — no frameworks, no build step, no dependencies.
