# iTunes India API — Easy Step-by-Step Guide

A beginner-friendly walkthrough. No API key, no signup, no payment, no server.
You can finish this in about 20 minutes.

---

## Before you start: what is an "API" here?

An API is just a web address that gives you data instead of a web page.

You open a normal link in your browser and see a website.
You open an API link in your browser and see **data** — names of songs, artists, image links.

That's it. Nothing to install.

---

## Step 1 — Open your first API link

Paste this into your browser's address bar and press Enter:

```
https://itunes.apple.com/search?term=Diljit+Dosanjh&entity=song&limit=3&country=in
```

You will see something like:

```json
{
  "resultCount": 3,
  "results": [
    {
      "trackName": "Lover",
      "artistName": "Diljit Dosanjh",
      "collectionName": "MoonChild Era",
      "previewUrl": "https://audio-ssl.itunes.apple.com/...m4a",
      "artworkUrl100": "https://is1-ssl.mzstatic.com/.../100x100bb.jpg",
      "trackTimeMillis": 231000
    }
  ]
}
```

**Congratulations — you just used the API.** No account was needed.

That block of text is called **JSON**. It's just data with labels.

---

## Step 2 — Understand the 4 parts of the link

```
https://itunes.apple.com/search?term=Diljit+Dosanjh&entity=song&limit=3&country=in
└──────── base address ────────┘ └──────────── parameters ─────────────────────┘
```

| Part | Meaning | What to use |
|---|---|---|
| `term` | what you're searching | any artist, song, or film name |
| `entity` | what kind of result | `song` (gives you playable previews) |
| `limit` | how many results | 1 to 200. Use 25 for a website |
| `country` | which Apple store | **`in`** for India — this is the important one |

### The one mistake everyone makes

If you forget `country=in`, Apple gives you the **American** catalogue.
Hindi and Punjabi songs will barely appear.

So always write `country=in` at the end. Every time.

---

## Step 3 — Try it with Indian artists

Change only the `term` part. Try these in your browser:

```
https://itunes.apple.com/search?term=Sidhu+Moose+Wala&entity=song&limit=5&country=in
https://itunes.apple.com/search?term=AP+Dhillon&entity=song&limit=5&country=in
https://itunes.apple.com/search?term=Arijit+Singh&entity=song&limit=5&country=in
```

Notice: spaces become `+` in the link. That's called URL encoding.

You can also search in Hindi or Punjabi writing. Copy this:

```
https://itunes.apple.com/search?term=ਦਿਲਜੀਤ&entity=song&limit=5&country=in
```

It works.

---

## Step 4 — Get bigger album covers (free trick)

Apple gives you a small 100×100 image by default:

```
.../100x100bb.jpg
```

Change `100x100bb` to `600x600bb` and you get a big, sharp cover — at no cost:

```
.../600x600bb.jpg
```

In code, that's just a find-and-replace:

```js
const bigCover = song.artworkUrl100.replace("100x100bb", "600x600bb");
```

---

## Step 5 — Make a real search box (copy this)

Create a file called `index.html` and paste this in. Then open it in your browser.

```html
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#111;color:#eee;padding:20px">

  <input id="box" placeholder="Type an artist name..." style="padding:10px;width:260px">
  <button id="btn" style="padding:10px 16px">Search</button>

  <div id="out" style="margin-top:20px"></div>

  <script>
    async function search() {
      const term = document.getElementById("box").value;

      const url = "https://itunes.apple.com/search?term="
                + encodeURIComponent(term)
                + "&entity=song&limit=25&country=in";

      const response = await fetch(url);
      const data = await response.json();

      const out = document.getElementById("out");
      out.innerHTML = "";

      data.results.forEach(function (song) {
        if (!song.previewUrl) return;   // skip songs without audio

        const cover = song.artworkUrl100.replace("100x100bb", "600x600bb");

        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:12px;align-items:center;margin:10px 0;cursor:pointer";
        row.innerHTML =
          '<img src="' + cover + '" width="50" height="50" style="border-radius:6px">' +
          "<div><b>" + song.trackName + "</b><br>" +
          "<small>" + song.artistName + "</small></div>";

        row.onclick = function () {
          new Audio(song.previewUrl).play();   // play 30 seconds
        };

        out.appendChild(row);
      });
    }

    document.getElementById("btn").onclick = search;
  </script>

</body>
</html>
```

**What this does:** you type a name, it asks Apple for songs, shows the cover and title,
and plays a 30-second clip when you click.

That's a working music search site. Nothing else is required.

---

## Step 6 — Show the Top Punjabi / Bollywood charts

Apple has a second free link for charts. No key needed either.

```
https://itunes.apple.com/in/rss/topsongs/limit=25/genre=100033/json    ← Top Punjabi
https://itunes.apple.com/in/rss/topsongs/limit=25/genre=1263/json      ← Top Bollywood
https://itunes.apple.com/in/rss/topsongs/limit=25/json                 ← Top India
```

The numbers are Apple's genre codes. Save this list:

| Chart | Number |
|---|---|
| Punjabi Pop | 100033 |
| Punjabi (general) | 100045 |
| Bollywood | 1263 |
| Sufi | 1268 |
| Devotional | 1267 |
| Indian Pop | 1185 |
| Tamil | 1264 |
| Telugu | 1265 |
| Haryanvi | 100041 |
| Bhojpuri | 100040 |

### One catch with charts

The chart link gives you the song name and cover, but **not** the audio preview.
You have to ask for the previews in a second request:

```js
// 1. get the chart
const res = await fetch("https://itunes.apple.com/in/rss/topsongs/limit=10/genre=100033/json");
const feed = await res.json();
const songs = feed.feed.entry;

// 2. collect their IDs
const ids = songs.map(s => s.id.attributes["im:id"]).join(",");

// 3. ask Apple for the details (this includes previewUrl)
const detail = await fetch("https://itunes.apple.com/lookup?id=" + ids + "&country=in");
const full = await detail.json();

console.log(full.results[0].trackName, full.results[0].previewUrl);
```

Remember `&country=in` on the second link too, or you'll get nothing back.

---

## Step 7 — Play the full song, legally

Here is the honest truth: **no free API gives you full Hindi or Punjabi songs.**
Those rights belong to T-Series, Sony Music India, Saregama, Speed Records.
Anyone offering free full songs is pirating them.

The legal free way is to let Apple play it inside your page.

You already have two numbers from the search results: `collectionId` and `trackId`.
Join them into this address:

```
https://embed.music.apple.com/in/album/COLLECTION_ID?i=TRACK_ID
```

Real example:

```
https://embed.music.apple.com/in/album/6825791151?i=6825791156
```

Put that in an iframe:

```html
<iframe
  src="https://embed.music.apple.com/in/album/6825791151?i=6825791156"
  height="175"
  frameborder="0"
  allow="autoplay *; encrypted-media *"
  style="width:100%;border-radius:12px">
</iframe>
```

**Why this is good:** Apple serves the audio, Apple pays the artists, and you pay nothing.
Visitors hear a preview; people with Apple Music hear the whole song.

Build the link in code like this:

```js
const fullSongLink =
  "https://embed.music.apple.com/in/album/" + song.collectionId + "?i=" + song.trackId;
```

---

## Step 8 — Don't get blocked (the rules)

Apple lets you use this for free, so be gentle.

| Rule | Why |
|---|---|
| Wait ~350 ms after the user stops typing before searching | Otherwise you fire a request per keystroke |
| Save results for 10–15 minutes | Repeated identical searches are wasteful |
| Use `/lookup` with comma-separated IDs | One request instead of ten |
| Keep `limit` at 25 for a website | Smaller, faster, kinder |
| Don't download the audio files | That's not covered by permission |
| Don't run the audio through your server | Link to Apple's file directly |

Roughly **20 requests per minute** is the safe pace. If you go over, you'll get errors back.

---

## Step 9 — Common problems and their fixes

**"My search returns American songs"**
You forgot `country=in`. Add it.

**"Hindi artist returns nothing"**
Check the country parameter, and try the artist in Latin letters.

**"previewUrl is empty for some songs"**
Normal. Not every track has a preview. Skip those rows in your UI (the code above does).

**"The cover image is blurry"**
Replace `100x100bb` with `600x600bb`.

**"It works on my laptop but not when I upload it"**
Open the browser console (F12). If you see a CORS error, make sure you're calling
`https://itunes.apple.com/...` with `https`, not `http`.

**"Chart list loads but no audio"**
You skipped Step 6's second request. The chart feed has no previews — use `/lookup`.

---

## Step 10 — Your final checklist

Print this and tick as you go:

- [ ] Opened a search link in the browser and saw JSON
- [ ] Added `country=in` and got Hindi/Punjabi results
- [ ] Made the cover images bigger with `600x600bb`
- [ ] Built a search box that lists songs
- [ ] Clicked a song and heard the 30-second preview
- [ ] Loaded a Top Punjabi or Top Bollywood chart
- [ ] Attached previews to the chart using `/lookup`
- [ ] Added the full-song Apple embed button
- [ ] Added a small delay so typing doesn't spam the API

When all boxes are ticked, you have a complete, free, legal Indian music site.

---

## Quick reference card

Keep this next to you.

```
SEARCH
https://itunes.apple.com/search?term=NAME&entity=song&limit=25&country=in

CHARTS
https://itunes.apple.com/in/rss/topsongs/limit=25/json
https://itunes.apple.com/in/rss/topsongs/limit=25/genre=100033/json

DETAILS + PREVIEWS (for chart IDs)
https://itunes.apple.com/lookup?id=ID1,ID2,ID3&country=in

BIG COVER
artworkUrl100.replace("100x100bb", "600x600bb")

30-SECOND PLAY
new Audio(song.previewUrl).play()

FULL SONG (legal)
https://embed.music.apple.com/in/album/{collectionId}?i={trackId}
```

**Cost: ₹0. Key needed: none. Signup: none. Server: none.**

---

Already built in this workspace, if you'd rather read finished code than build it:

- `itunes-india.html` — full working page (search + charts + player + full-song embed)
- `music-api.js` — the same thing as reusable functions
- `ITUNES-INDIA-PROCESS.md` — the technical version of this guide
