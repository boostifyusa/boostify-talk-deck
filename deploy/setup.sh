#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu droplet. Run as a sudo-capable user:
#   curl -fsSL https://raw.githubusercontent.com/boostifyusa/boostify-talk-deck/main/deploy/setup.sh | bash
# or: git clone the repo, then  bash deploy/setup.sh
set -euo pipefail

REPO="https://github.com/boostifyusa/boostify-talk-deck.git"
APP_DIR="/opt/boostify-talk-deck"
WEB_ROOT="/var/www/boostify-talk-deck"
SITE="boostify-talk-deck"

echo "==> Installing nginx, git, rsync"
sudo apt-get update -y
sudo apt-get install -y nginx git rsync

echo "==> Cloning repo to $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo git clone "$REPO" "$APP_DIR"
else
  sudo git -C "$APP_DIR" pull --ff-only
fi

echo "==> Syncing to web root $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete --exclude '.git' --exclude '_test.html' --exclude '_source-deck.html' --exclude 'build.js' --exclude 'deploy' "$APP_DIR/" "$WEB_ROOT/"

echo "==> Installing nginx site"
sudo cp "$APP_DIR/deploy/nginx.conf" "/etc/nginx/sites-available/$SITE"
sudo ln -sf "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
sudo rm -f /etc/nginx/sites-enabled/default

echo "==> Testing and reloading nginx"
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

IP=$(curl -fsSL https://ifconfig.me 2>/dev/null || echo "<droplet-ip>")
echo "Done. Visit  http://$IP/"
echo "For HTTPS later:  sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx"
