# Boostify Talk Deck — Get Seen, Get Hired

Interactive web version of the Central Valley Native Economic Summit talk
(Table Mountain, June 26 2026). Built on [reveal.js](https://revealjs.com) 5.1,
vendored locally so it runs on the droplet with no external JS dependency.

## What it does
- Lands on an orange **start screen**. One click goes **full screen** and opens the deck on slide 1.
  (Browsers only allow full screen from a user action, so the click is required.)
- Each slide's content **animates in on arrival** — no clicking through fragments.
- **Slide transitions** between slides.
- **Overview / zoom-out** grid to jump to any slide: press `O` or `Esc`, or click the grid button (bottom-right).

### Controls
| Key | Action |
|-----|--------|
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| `O` or `Esc` | Overview (zoom out, pick a slide) |
| `F` | Full screen |
| `.` | Pause / black screen |

## Files
- `index.html` — the presentation (this is what gets served).
- `vendor/reveal/` — reveal.js + reveal.css, vendored.
- `_source-deck.html` — the original static deck (content source of truth).
- `build.js` — regenerates `index.html` from `_source-deck.html` (`node build.js`).
- `deploy/` — nginx config and droplet scripts.

To change content: edit `_source-deck.html`, run `node build.js`, commit, redeploy.

## Host it on a DigitalOcean Ubuntu droplet

**First time** (on a fresh standard Ubuntu droplet, as a sudo user):
```bash
git clone https://github.com/boostifyusa/boostify-talk-deck.git
cd boostify-talk-deck
bash deploy/setup.sh
```
This installs nginx, copies the files to `/var/www/boostify-talk-deck`, installs the
site config, and reloads nginx. When it finishes it prints the URL — open
`http://<droplet-ip>/` and you're on slide 1.

**Updates** after that:
```bash
bash deploy/deploy.sh    # pulls latest from GitHub and reloads
```

**HTTPS (optional, later):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```
