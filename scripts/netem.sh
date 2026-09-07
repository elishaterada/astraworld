#!/usr/bin/env bash
# Test-only impairment. Run solely on a disposable Linux runner, never the user's network.
set -euo pipefail
[[ "${M1_NETEM:-}" == 1 && "$(uname -s)" == Linux ]] || { echo 'Requires M1_NETEM=1 on disposable Linux'; exit 1; }
case "${1:-}" in
  setup)
    sudo modprobe ifb
    sudo ip link add m1ifb type ifb
    sudo ip link set m1ifb up
    sudo tc qdisc add dev m1ifb root handle 10: netem limit 10000
    sudo tc qdisc add dev lo handle ffff: ingress
    for port in 3103 3104; do
      for field in src_port dst_port; do
        sudo tc filter add dev lo parent ffff: protocol ip flower ip_proto tcp "$field" "$port" action mirred egress redirect dev m1ifb
      done
    done
    ;;
  clean) sudo tc qdisc change dev m1ifb root handle 10: netem limit 10000 ;;
  normal) sudo tc qdisc change dev m1ifb root handle 10: netem limit 10000 delay 75ms 15ms loss random 1% ;;
  high) sudo tc qdisc change dev m1ifb root handle 10: netem limit 10000 delay 150ms 15ms loss random 1% ;;
  outage) sudo tc qdisc change dev m1ifb root handle 10: netem limit 10000 loss random 100% ;;
  stats) sudo tc -s -j qdisc show dev m1ifb ;;
  cleanup)
    sudo tc qdisc del dev lo ingress 2>/dev/null || true
    sudo ip link del m1ifb 2>/dev/null || true
    ;;
  *) echo 'Expected setup|clean|normal|high|outage|stats|cleanup'; exit 2 ;;
esac
