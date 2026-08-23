# Sigenic Partner Portal — Migration Guide

**Date:** August 2026  
**Status:** UAT and Production live on Tencent Cloud  
**Related doc:** [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)

---

## 1. Why we migrated

The Partner Portal was previously hosted on **Hostinger**. It was moved to **Tencent Cloud Lighthouse** for:

- Better control of the Node.js runtime and reverse proxy
- Separation of **UAT** and **Production** onto dedicated servers
- Standard nginx + Let’s Encrypt TLS
- Clearer operations (PM2, local health checks, env templates)

---

## 2. Before → After

| Item | Before (Hostinger) | After (Tencent) |
|------|--------------------|-----------------|
| Hosting | Hostinger Node hosting | Tencent Lighthouse VMs |
| UAT URL | `https://uat-partner.sigenic.com` | Same URL → new IP `43.160.219.229` |
| Prod URL | `https://partner.sigenic.com` | Same URL → new IP `43.156.19.185` |
| Process | Hostinger Node manager | **PM2** |
| Proxy / TLS | Hostinger / LiteSpeed | **nginx** + **Let’s Encrypt** |
| UAT database | Neon PostgreSQL | Neon PostgreSQL (unchanged UAT project) |
| Prod database | Neon PostgreSQL | **Local PostgreSQL** on prod VM (`sigenic_prod`) |
| DNS | Pointed at Hostinger IPs | Updated in **Wix** to Tencent IPs |

---

## 3. New environment map

```text
                    Wix DNS
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
uat-partner.sigenic.com      partner.sigenic.com
   43.160.219.229               43.156.19.185
         │                           │
      nginx:443                   nginx:443
         │                           │
    Node :3003                   Node :3002
         │                           │
    Neon (UAT)              Postgres local
                            DB: sigenic_prod
```

| Env | Public URL | Server IP | App directory | Port | Database |
|-----|------------|-----------|---------------|------|----------|
| **UAT** | https://uat-partner.sigenic.com | `43.160.219.229` | `/www/wwwroot/uat-partner` | `3003` | Neon (UAT) |
| **Production** | https://partner.sigenic.com | `43.156.19.185` | `/www/wwwroot/sigenic-prod` | `3002` | Local Postgres `sigenic_prod` |

Templates for env files (no secrets in git):

- `.env.uat.example`
- `.env.production.example`
- `.env.example` (local)

---

## 4. What was completed

### DNS (Wix)
- `uat-partner.sigenic.com` → `43.160.219.229`
- `partner.sigenic.com` → `43.156.19.185`
- Authoritative DNS is **Wix** (`ns6/ns7.wixdns.net`). Hostinger DNS for these names is not used.

### UAT
- App running behind nginx with HTTPS
- SMTP working (`sales@sigenic.com` auth, intended From `noreply@sigenic.com`)
- Health: `https://uat-partner.sigenic.com/api/health`

### Production
- App deployed on Singapore VM (`KCCDigital-Apps-PROD-SG`)
- nginx reverse proxy → `127.0.0.1:3002`
- Let’s Encrypt certificate for `partner.sigenic.com`
- New empty production database on the VM (schema + demo seed on first boot)
- Old Neon connection string **backed up** on the server (not deleted)
- Health: `https://partner.sigenic.com/api/health` → database `sigenic_prod`

### Email
- SMTP: `smtp.gmail.com:587` (STARTTLS)
- Login user: `sales@sigenic.com` (primary mailbox)
- Visible From: `Sigenic <noreply@sigenic.com>` (alias)
- Google may still rewrite From to `sales@` until **Send mail as** is verified for `noreply@` in Gmail

---

## 5. Production database decision

### Problem
The previous **Neon production** project returned:

```text
compute time quota exceeded (PostgreSQL error 53000)
```

The client does not have Neon account access (likely created by the previous developer). Export from the locked Neon project was not possible at cutover time.

### Decision (client-approved)
1. Create a **new, separate** production database on the prod VM  
2. Do **not** share UAT’s database  
3. Keep old Neon credentials documented for later recovery  
4. Do **not** treat historical data as permanently lost while Neon/backup recovery is pursued  
5. Import later if a PostgreSQL dump or Neon access is provided  

### Current prod DB
| Field | Value |
|-------|--------|
| Engine | PostgreSQL on the prod VM |
| Name | `sigenic_prod` |
| Host | `127.0.0.1:5432` (localhost only) |
| App user | `sigenic_prod` |
| Content | Fresh schema + **demo seed** (not historical Hostinger/Neon data) |

Demo admin after seed: `founder-demo@sigenic.com` / `demo`  
(Replace with a real client admin after go-live.)

---

## 6. How to verify you are on the new servers

```bash
# DNS must show the Tencent IPs
dig +short uat-partner.sigenic.com @8.8.8.8   # → 43.160.219.229
dig +short partner.sigenic.com @8.8.8.8       # → 43.156.19.185

# Health (prod must report local DB name)
curl -sS https://partner.sigenic.com/api/health
# {"ok":true,"database":{"database":"sigenic_prod",...},...}

curl -sS https://uat-partner.sigenic.com/api/health
```

Signup and login pages on https://partner.sigenic.com are served by the new production VM.

---

## 7. Day-2 operations

### Restart app
```bash
# UAT
pm2 restart uat-partner

# Prod
pm2 restart sigenic-prod
```

### Logs
```bash
pm2 logs uat-partner --lines 100
pm2 logs sigenic-prod --lines 100
```

### Reload nginx
```bash
nginx -t && systemctl reload nginx
```

### Env changes
Edit `/www/wwwroot/<app>/.env`, then restart PM2 with a **clean environment**  
(`loadEnvFile` does not override variables already set in the process).

---

## 8. Restoring historical production data (later)

When the previous developer provides a dump or Neon access:

1. Take a backup of current `sigenic_prod`
2. Restore into a staging DB first and validate schema
3. Schedule a cutover window
4. Restore into production (or swap DBs)
5. Restart `sigenic-prod` and retest login + critical flows

Example (plain SQL dump):

```bash
psql -h 127.0.0.1 -U sigenic_prod -d sigenic_prod -f backup.sql
```

---

## 9. Open items

| Item | Owner | Notes |
|------|--------|------|
| Neon historical data recovery | Client / previous developer | Dump or account access needed |
| Gmail “Send mail as” for `noreply@` | Client | So From is not rewritten to `sales@` |
| Replace demo admin with real admin | Ops | Change password / create client user |
| Automated Postgres backups on prod VM | Ops | `pg_dump` cron recommended |
| Secure credential handover | Ops → Client | DB user/password via secure channel |

---

## 10. Summary for stakeholders

- **UAT** and **Production** now run on **Tencent Cloud**, not Hostinger.  
- Public URLs are unchanged; only the **DNS A records** (in Wix) changed.  
- **Production data** on the new server starts **fresh** because the old Neon DB was quota-locked and inaccessible.  
- Old Neon details were **preserved** for a future import.  
- HTTPS, nginx, PM2, and health checks are in place on both environments.

For full runtime details (ports, paths, commands), see **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)**.
