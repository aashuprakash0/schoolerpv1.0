# Adarsh Avasiya School ERP

A Next.js + TypeScript + Tailwind-style CSS + Supabase PostgreSQL/Auth application for school student and fee management.

## Stack
- Next.js + React + TypeScript
- CSS UI (kept dependency-light; can be migrated to Tailwind later)
- Supabase PostgreSQL
- Supabase Auth + Row Level Security
- Supabase Storage (ready for future attachments)
- Vercel deployment
- GitHub source control
- SheetJS (`xlsx`) for Excel import
- jsPDF for optional receipts

## Core workflow
Academic session -> fee structure -> student charges -> back dues -> payment -> payment allocation -> remaining balance -> optional receipt.

Vehicle students: school + vehicle components are kept together under the same monthly charge, while still being separately identifiable for reporting.

Special charges: books, tie & belt, admission, re-admission, Republic Day, Independence Day, Saraswati Puja and future custom charges are stored as generic student charges.

## First setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql` in full.
3. In Supabase Authentication -> Users, create the admin user.
4. Insert/update that Auth user's row in `public.profiles` with role `admin` (example SQL is at the end of schema.sql).
5. In Vercel, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use the Supabase Project URL and Publishable key).
6. Redeploy after changing environment variables.

## Local development
```bash
npm install
npm run dev
```

## Important security note
Only the Supabase Project URL and Publishable key belong in browser code. Never commit a Supabase secret/service-role key.

## Current MVP pages
- `/login`
- `/admin`
- `/admin/students`
- `/admin/fee-structure`
- `/admin/charges`
- `/admin/back-dues`
- `/admin/collection`
- `/admin/reports`
- `/admin/notices`
- `/notices`

## Next implementation phase
The SQL contains the ledger foundation and a payment RPC. The next UI phase should add automatic monthly charge generation from fee structures, family/sibling confirmation, adjustment approval workflow, detailed student statements, class-wise outstanding reports, and stronger receipt allocation display.
