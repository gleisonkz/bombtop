# Game server on the VPS

Hostinger KVM 1, Campinas (BR), Ubuntu; ~6 ms from São Paulo (Render's Oregon was ~196 ms).
Public URL: `wss://187-127-63-110.sslip.io` (Caddy terminates TLS, proxies to `127.0.0.1:2567`).

- `bombtop.service`: the Colyseus server (`tsx`), user `bombtop`, app in `/opt/bombtop/app`.
- `bombtop-update.timer` runs `update.sh` every minute: when `origin/main` moved, it pulls,
  reinstalls the server's deps, reinstalls these unit files and the Caddyfile, and restarts.
  So a push to `main` reaches the server within ~1-2 minutes.
- `bombtop-net.service` runs `net-tune.sh` at boot (and on each deploy): TCP retransmits after 50 ms
  instead of 200 ms and thin streams back off linearly, so a packet lost on a phone's Wi-Fi
  stalls the game for less.
- Logs: `journalctl -u bombtop -f`, deploys: `journalctl -u bombtop-update`.
- Connection reports from players who opened the game with `?debug` (every 5 s: ping, render delay,
  fps, frames without a snapshot, worst gap between snapshots, user agent):
  `/opt/bombtop/logs/net-YYYY-MM-DD.jsonl`, one JSON line each (`LOG_DIR` in `bombtop.service`).
  Telling a lag's cause apart: `gap` high = the network (or the server) held snapshots back; `slow` high
  with `work` low = the phone/browser stalled (`work` is the most CPU time our own code spent on one
  frame, tenths of a ms); `tick` = the room's slowest simulation tick on the server, tenths of a ms
  (a tick has 16.67 ms; `pnpm -C packages/shared bench` measures it offline).
- Access: `ssh -i ~/.ssh/bombtop_vps root@187.127.63.110` (key only).

One-time setup (already done): Node 24 in /usr/local, `apt install git caddy ufw`, ufw allows
22/80/443, `useradd --system --home-dir /opt/bombtop bombtop`, clone into `/opt/bombtop/app`,
copy the units to /etc/systemd/system, `systemctl enable --now bombtop bombtop-update.timer`.
