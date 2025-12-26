# SalonX Production Deployment Guide

## Quick Deploy (Vercel Recommended)

### 1. Push to GitHub
```bash
git add .
git commit -m "Production ready"
git push origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

### 3. Setup Supabase
Run these SQL files in order:
1. `database.sql`
2. `auth_schema.sql`
3. `attendance_migration.sql`
4. `inventory_schema.sql`
5. `billing_schema.sql`

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side operations | ✅ |

---

## Production Checklist

- [ ] Supabase project created
- [ ] All SQL schemas applied
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled (auto on Vercel)

---

## Modules Included

| Module | Status |
|--------|--------|
| Dashboard | ✅ |
| Appointments | ✅ |
| Customers | ✅ |
| Staff | ✅ |
| Services | ✅ |
| Attendance | ✅ |
| Products & Inventory | ✅ |
| Billing / POS | ✅ |
| Reports | ✅ |
| Settings | ✅ |
| Admin Panel | ✅ |

---

## Support

For issues, check:
1. Browser console for errors
2. Vercel deployment logs
3. Supabase logs
