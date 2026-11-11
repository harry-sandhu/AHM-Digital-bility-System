# Deploying the backend + OCR service on your own VPS

What runs on the VPS (Ubuntu 24.04, 4 GB): **Caddy** (HTTPS) → **backend** (Rust) → **OCR service** (Python).
MongoDB stays on Atlas; the frontend stays on Vercel. Only Caddy is open to the internet.

```
browser ──https──▶ api.apnibilty.com ─▶ Caddy ─▶ backend ─▶ OCR service
                                                   └──────▶ MongoDB Atlas
```

Images are built on GitHub (`.github/workflows/images.yml`), not on the VPS - compiling the Rust
backend on a 4 GB machine can run out of memory.

## 1. Order the VPS
Choose **Ubuntu 24.04 LTS**. Add your SSH public key in the provider's panel if it offers that.
Note the server's **IP address**.

## 2. DNS (Namecheap → Domain List → Manage → Advanced DNS)
Add one record, and leave everything else (the `@` / `www` records that point at Vercel) alone:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `api` | *the VPS IP* | Automatic |

Check it from your computer: `dig +short api.apnibilty.com` should print the VPS IP.

## 3. MongoDB Atlas
Atlas → **Network Access** → **Add IP Address** → the VPS IP. (Without this the backend can't connect.)
Atlas's free tier has no backups - see "Backups" below.

## 4. Prepare the server
```sh
ssh root@<VPS-IP>
apt-get update && apt-get install -y git
git clone https://github.com/harry-sandhu/AHM-Digital-bility-System.git /opt/bilty
bash /opt/bilty/deploy/setup-vps.sh      # swap, Docker, firewall, fail2ban, auto security updates
```
Hardening (do this *after* you've confirmed you can log in another way, so you don't lock yourself out):
create a normal user, copy your SSH key to it, check that login works, then set
`PasswordAuthentication no` and `PermitRootLogin no` in `/etc/ssh/sshd_config` and `systemctl reload ssh`.

## 5. Get the images
Push to `main` (the workflow builds `bilty-backend` and `bilty-ocr` and publishes them to
`ghcr.io/<owner>/…`). Check GitHub → **Actions** for green runs. Then either:
- make both packages public (GitHub → your profile → **Packages** → each package → *Package settings* →
  *Change visibility*; the images contain no secrets - those are supplied at run time), **or**
- keep them private and on the VPS run `docker login ghcr.io` with a personal access token that has `read:packages`.

## 6. Configure and start
```sh
cd /opt/bilty/deploy
cp .env.example .env
nano .env            # fill in MONGO_URI, JWT_SECRET, OCR_KEY, FRONTEND_URL, SUPERADMIN_*
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f backend      # "server listening"  and  "OCR service configured"
```
Use the same `MONGO_URI` / `JWT_SECRET` as on Render so existing users and logins keep working.
Generate secrets with `openssl rand -hex 48` (JWT) and `openssl rand -hex 24` (OCR_KEY).

Check: `curl https://api.apnibilty.com/api/health` (the first request can take ~30 s while Caddy gets the certificate).

## 7. Switch the frontend (Vercel)
Project → Settings → Environment Variables → set `VITE_API_URL=https://api.apnibilty.com` (Production) → redeploy.
`FRONTEND_URL` in the server's `.env` must list every origin the site is served from.
Keep Render running until you've tried login, saving, printing and a bill scan on the new setup.
**Rollback** = set `VITE_API_URL` back to the Render URL and redeploy.

## Day to day
- **Update:** after pushing code and seeing the green GitHub run: `cd /opt/bilty/deploy && docker compose pull && docker compose up -d`
- **Look at memory:** `docker stats --no-stream` and `free -h`
- **Logs:** `docker compose logs --tail 100 backend` (or `ocr`, `caddy`)
- **Restart one thing:** `docker compose restart ocr`

## Backups
Data lives in Atlas. The free tier does not back up, so run `deploy/backup.sh` daily
(cron line is in the script) and copy `deploy/backups/` to another machine or cloud storage now and then.

## Notes
- The OCR service is capped at 1.2 GB and the backend at 700 MB so a runaway process can't take the whole 4 GB.
- The backend's rate limiter reads the real client address from Caddy's `X-Forwarded-For` (only when the
  connection comes from the private network), so users don't share one login limit.
- Nothing in this folder has been run on a real server yet: expect to fix small things on the first deploy.
