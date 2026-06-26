#!/usr/bin/env bash
# Host the deck at presentation.boostifyusa.com on this droplet, as its own vhost.
# Safe to run next to other sites: it adds a name-based server block and a separate
# web root, and never touches the default server or other vhosts.
#
# Run on the droplet (as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/boostifyusa/boostify-talk-deck/main/deploy/setup-subdomain.sh | sudo bash
#
# Re-run anytime to pull the latest deck and redeploy.
set -euo pipefail

REPO="https://github.com/boostifyusa/boostify-talk-deck.git"
APP_DIR="/opt/boostify-talk-deck"
WEB_ROOT="/var/www/presentation"
HOST="presentation.boostifyusa.com"

echo "==> Ensuring nginx, git, rsync"
command -v nginx >/dev/null 2>&1 || { apt-get update -y && apt-get install -y nginx; }
command -v git   >/dev/null 2>&1 || apt-get install -y git
command -v rsync >/dev/null 2>&1 || apt-get install -y rsync

echo "==> Fetching the deck into $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

echo "==> Publishing to $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete \
  --exclude '.git' --exclude '_test.html' --exclude '_source-deck.html' \
  --exclude 'build.js' --exclude 'deploy' \
  "$APP_DIR/" "$WEB_ROOT/"

echo "==> Installing the $HOST vhost"
cp "$APP_DIR/deploy/presentation.nginx.conf" "/etc/nginx/sites-available/$HOST"
ln -sf "/etc/nginx/sites-available/$HOST" "/etc/nginx/sites-enabled/$HOST"

echo "==> Testing and reloading nginx"
nginx -t
systemctl reload nginx

echo
echo "Done. The deck is served for $HOST on port 80 (the default site is untouched)."
echo "Next: in Cloudflare, add  A  presentation -> 137.184.239.214  (Proxied / orange cloud)."
echo "SSL/TLS mode 'Full' or 'Flexible' will both serve https://$HOST/ via Cloudflare."
