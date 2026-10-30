# Game server on the VPS

Hostinger KVM 1, Campinas (BR), Ubuntu; ~6 ms from São Paulo (Render's Oregon was ~196 ms).
Public URL: https://bombtop.tech (Caddy terminates TLS). The client is served from `/srv/bombtop/current`
(a release put there by GitHub Actions, `.github/workflows/deploy-client.yml`, as user `deploy`; the last 3 are kept)
and the game server is proxied under `/colyseus` to `127.0.0.1:2567`. `wss://187-127-63-110.sslip.io` still reaches it.

- `bombtop.service`: the Colyseus server (`tsx`), user `bombtop`, app in `/opt/bombtop/app`.
- `bombtop-update.timer` runs `update.sh` every minute: when `origin/main` moved, it pulls,
  reinstalls the server's deps, reinstalls these unit files and the Caddyfile, and restarts.
  So a push to `main` reaches the server within ~1-2 minutes.
- `bombtop-net.service` runs `net-tune.sh` at boot (and on each deploy): TCP retransmits after 50 ms
  instead of 200 ms and thin streams back off linearly, so a packet lost on a phone's Wi-Fi
  stalls the game for less.
- Logs: `journalctl -u bombtop -f`, deploys: `journalctl -u bombtop-update`.
- Connection reports from every player in a match (every 5 s: ping, render delay, fps, frames without a
  snapshot, worst gap between snapshots, the page's memory `mem` MB (Chrome only) and the device's `dm` GB,
  user agent): `/opt/bombtop/logs/net-YYYY-MM-DD.jsonl`, one JSON line each (`LOG_DIR` in `bombtop.service`).
  `?debug` only adds the readout on screen. Offline (Wi-Fi) matches have no room here: their phones send the same
  reports over HTTP when they have internet (`POST /net`, `offlineNetRoute`), logged as room `wifi:<code>` with
  `route`: `wifi` (the phones talk straight over the Wi-Fi or through its router) or `internet` (out and back: a phone on
  mobile data, or a Wi-Fi keeping its devices apart).
- Pages' own events, from every visitor (`POST /log`, `apps/server/src/client-log.ts`; at most 20 a minute an
  address): `/opt/bombtop/logs/client-YYYY-MM-DD.jsonl`. `boot` = a page opened (path, screen size, device
  memory, build `v`, user agent); `crash` = the last page died in front of the player without closing (what
  it was doing, `crumb`, and how long it had been open, `age` ms): what iOS does past its memory limit,
  showing "a problem repeatedly occurred"; `error` = an uncaught script error with its stack; `console` = a
  failure the page caught and wrote with console.error/warn (`level`; a sheet or sound that did not load);
  `freeze` = the page's thread stopped answering for 5 s while in front (sent by a worker, so it arrives even
  if the page never comes back; `crumb` = what it was doing) and `unfreeze` = it came back, `ms` stuck in all.
  A `crash` with no `freeze` before it is the page killed (memory); with one, it froze and was closed.
  Read them: `ssh -i ~/.ssh/bombtop_vps root@187.127.63.110 'grep -h crash /opt/bombtop/logs/client-*.jsonl | tail'`.
  Telling a lag's cause apart: `gap` high = the network (or the server) held snapshots back; `slow` high
  with `work` low = the phone/browser stalled (`work` is the most CPU time our own code spent on one
  frame, tenths of a ms); `tick` = the room's slowest simulation tick on the server, tenths of a ms
  (a tick has 16.67 ms; `pnpm -C packages/shared bench` measures it offline).
- Access: `ssh -i ~/.ssh/bombtop_vps root@187.127.63.110` (key only).

One-time setup (already done): Node 24 in /usr/local, `apt install git caddy ufw`, ufw allows
22/80/443, `useradd --system --home-dir /opt/bombtop bombtop`, clone into `/opt/bombtop/app`,
copy the units to /etc/systemd/system, `systemctl enable --now bombtop bombtop-update.timer`.
