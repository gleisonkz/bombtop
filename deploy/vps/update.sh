#!/usr/bin/env bash
# Pulls origin/main and, when it moved, reinstalls and restarts the game server.
# Run every minute by bombtop-update.timer (as root); the app lives in /opt/bombtop/app.
set -euo pipefail
APP=/opt/bombtop/app
as_app() { sudo -u bombtop -H bash -c "cd $APP && $*"; }

as_app git fetch -q origin main
[ "$(as_app git rev-parse HEAD)" = "$(as_app git rev-parse origin/main)" ] && exit 0

as_app git reset -q --hard origin/main
as_app npx --yes pnpm@12.11.2 install --frozen-lockfile --filter @bombtop/server...
install -m 644 "$APP/deploy/vps/bombtop.service" /etc/systemd/system/bombtop.service
install -m 644 "$APP/deploy/vps/bombtop-net.service" /etc/systemd/system/bombtop-net.service
install -m 644 "$APP/deploy/vps/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable -q bombtop-net
systemctl restart bombtop-net
systemctl restart bombtop
systemctl reload caddy
echo "deployed $(as_app git rev-parse --short HEAD)"
