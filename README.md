# SalonX - Salon Management Software

A premium, production-grade salon management system built with Next.js and Supabase.

## Features

- 📅 Appointment scheduling with drag-drop calendar
- 👥 Customer memory system with timeline
- 👨‍💼 Staff management
- 💇 Services & pricing
- 💳 Zero-friction POS/Billing with Razorpay
- 📊 Owner insights & reports
- ⚙️ Settings & configuration

## Tech Stack

- **Frontend:** Next.js 14 + TypeScript
- **Styling:** Vanilla CSS (Premium aesthetic)
- **Database:** Supabase (PostgreSQL + RLS)
- **ORM:** Prisma
- **Payments:** Razorpay

---

## Getting Started

### Prerequisites

- Node.js 18.17+
- npm or yarn
- Supabase project ([supabase.com](https://supabase.com))
- Razorpay account (for payments)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd SalonX
npm install

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `RAZORPAY_KEY_ID` | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret (server-only) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Key ID (for client) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |
| `NEXT_PUBLIC_DB_MODE` | `local` or `supabase` |
| `NEXT_PUBLIC_APP_URL` | Production URL |

---

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Database Setup

1. Create a Supabase project
2. Run the SQL from `supabase/database.sql` in the SQL editor
3. Enable Row Level Security (RLS) policies

### Razorpay Webhooks

1. In Razorpay Dashboard → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/razorpay`
3. Select events: `payment.captured`, `payment.failed`, `refund.created`
4. Copy webhook secret to `RAZORPAY_WEBHOOK_SECRET`

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check for monitoring |
| `/api/payments/create-order` | POST | Create Razorpay order |
| `/api/payments/verify` | POST | Verify payment signature |
| `/api/webhooks/razorpay` | POST | Razorpay webhook handler |

---

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## License

Private - All rights reserved
