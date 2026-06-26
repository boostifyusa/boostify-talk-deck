#!/usr/bin/env bash
# Update an already-set-up droplet to the latest committed deck.
#   bash deploy/deploy.sh     (run on the droplet, or from /opt/boostify-talk-deck)
set -euo pipefail

APP_DIR="/opt/boostify-talk-deck"
WEB_ROOT="/var/www/boostify-talk-deck"

echo "==> Pulling latest"
sudo git -C "$APP_DIR" pull --ff-only

echo "==> Syncing to $WEB_ROOT"
sudo rsync -a --delete --exclude '.git' --exclude '_test.html' --exclude '_source-deck.html' --exclude 'build.js' --exclude 'deploy' "$APP_DIR/" "$WEB_ROOT/"

sudo nginx -t && sudo systemctl reload nginx
echo "Deployed latest."
