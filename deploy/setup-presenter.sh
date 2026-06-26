#!/usr/bin/env bash
# Turnkey deploy of the deck + presenter server to presentation.boostifyusa.com.
# Installs Node, runs server.js as a systemd service, and points an nginx vhost at it.
# Coexists with anything else on the droplet (its own server_name + its own service).
#
# Run on the droplet as root (or sudo). Pass your PIN (and optional Brevo key):
#   PIN=4291 BREVO_KEY=xxxxxxxx bash <(curl -fsSL https://raw.githubusercontent.com/boostifyusa/boostify-talk-deck/main/deploy/setup-presenter.sh)
#
# Re-run anytime to pull the latest deck (it restarts the service).
set -euo pipefail

REPO="https://github.com/boostifyusa/boostify-talk-deck.git"
APP="/opt/boostify-talk-deck"
HOST="presentation.boostifyusa.com"
PORT=8800
PIN="${PIN:-CHANGE-ME}"
BREVO_KEY="${BREVO_KEY:-}"

echo "==> Packages (node, git, nginx)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git nginx
command -v node >/dev/null 2>&1 || apt-get install -y nodejs    # Ubuntu 24.04 ships node 18+ (has global fetch)

echo "==> Code -> $APP"
if [ ! -d "$APP/.git" ]; then git clone "$REPO" "$APP"; else git -C "$APP" pull --ff-only; fi

echo "==> Config (secrets stay on the box, never in git)"
if [ ! -f "$APP/presenter.config.json" ]; then
  cat > "$APP/presenter.config.json" <<JSON
{
  "pin": "$PIN",
  "ownerEmail": "victor@boostifyusa.com",
  "senderEmail": "website@boostifyusa.com",
  "senderName": "Boostify Presentation",
  "brevoKey": "$BREVO_KEY",
  "host": "127.0.0.1",
  "port": $PORT
}
JSON
  echo "   wrote presenter.config.json (PIN=$PIN). Edit it later to change PIN / add an active Brevo key."
else
  echo "   presenter.config.json already exists — left as-is."
fi

echo "==> systemd service"
cat > /etc/systemd/system/boostify-deck.service <<UNIT
[Unit]
Description=Boostify talk deck + presenter server
After=network.target
[Service]
WorkingDirectory=$APP
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable boostify-deck
systemctl restart boostify-deck

echo "==> nginx vhost ($HOST -> 127.0.0.1:$PORT, http + https)"
# Cloudflare (Full) connects to the origin on 443, so we need an https listener too.
# Reuse the box's existing boostifyusa.com cert (a CN mismatch is fine under CF "Full").
SSLBLOCK=""
if [ -f /etc/letsencrypt/live/boostifyusa.com/fullchain.pem ]; then
  SSLBLOCK="
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $HOST;
    ssl_certificate /etc/letsencrypt/live/boostifyusa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/boostifyusa.com/privkey.pem;
    location / { proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
}"
fi
cat > "/etc/nginx/sites-available/$HOST" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;
    location / { proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
}
$SSLBLOCK
NGINX
ln -sf "/etc/nginx/sites-available/$HOST" "/etc/nginx/sites-enabled/$HOST"
nginx -t
systemctl reload nginx

echo
echo "Done. Service: systemctl status boostify-deck   Logs: journalctl -u boostify-deck -f"
echo "Cloudflare: add  A  presentation -> 137.184.239.214  (Proxied). SSL Full or Flexible."
echo "Then open https://$HOST/  (PIN ${PIN})."
