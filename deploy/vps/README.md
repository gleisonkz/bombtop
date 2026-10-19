# Game server on the VPS

Hostinger KVM 1, Campinas (BR), Ubuntu; ~6 ms from São Paulo (Render's Oregon was ~196 ms).
Public URL: `wss://187-127-63-110.sslip.io` (Caddy terminates TLS, proxies to `127.0.0.1:2567`).

- `bombtop.service`: the Colyseus server (`tsx`), user `bombtop`, app in `/opt/bombtop/app`.
- `bombtop-update.timer` runs `update.sh` every minute: when `origin/main` moved, it pulls,
  reinstalls the server's deps, reinstalls these unit files and the Caddyfile, and restarts.
  So a push to `main` reaches the server within ~1-2 minutes.
- Logs: `journalctl -u bombtop -f`, deploys: `journalctl -u bombtop-update`.
- Access: `ssh -i ~/.ssh/bombtop_vps root@187.127.63.110` (key only).

One-time setup (already done): Node 24 in /usr/local, `apt install git caddy ufw`, ufw allows
22/80/443, `useradd --system --home-dir /opt/bombtop bombtop`, clone into `/opt/bombtop/app`,
copy the units to /etc/systemd/system, `systemctl enable --now bombtop bombtop-update.timer`.
