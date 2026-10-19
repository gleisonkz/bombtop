#!/usr/bin/env bash
# Quicker TCP loss recovery for the game's small, steady stream (a snapshot every 33 ms):
# a lost packet on a phone's Wi-Fi otherwise stalls the WebSocket for 200+ ms.
# Run at boot by bombtop-net.service (as root).
set -euo pipefail
# Thin streams retransmit on a steady timer instead of backing off exponentially.
sysctl -q -w net.ipv4.tcp_thin_linear_timeouts=1
# Retransmit after 50 ms instead of Linux's 200 ms floor, and ACK right away.
route=$(ip route show default | head -1 | sed -E 's/ (rto_min( lock)?|quickack) [^ ]+//g')
ip route change $route quickack 1 rto_min 50ms
