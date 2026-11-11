#!/bin/bash
# One-time server preparation for Ubuntu 24.04. Run as root:  bash setup-vps.sh
# Safe to run again. It does NOT touch SSH login settings (see README step 4).
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

echo "== updates"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "== 2 GB swap (safety net on a 4 GB machine)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

echo "== Docker + compose, firewall, brute-force protection, automatic security updates"
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 ufw fail2ban unattended-upgrades git curl
systemctl enable --now docker fail2ban

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== done"
free -h | sed -n '1,2p'
ufw status | head -8
