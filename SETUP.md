# Paywall setup: accounts + automatic payment

How it works:

1. Visitors get the **free page** (`docs/index.html`): Module 2 only. Modules 3–5 are not in this file at all.
2. They create an account (email + password, Supabase Auth) and click **Pay €5**. That opens Stripe's payment page (iDEAL or card).
3. After payment Stripe calls the `stripe-webhook` function, which marks the account as paid in the `purchases` table.
4. When a paid user is logged in, the free page asks the `app` function for the full app. That function checks the login and the payment, and only then sends `app.html` from private storage. The full app opens over the free page; progress and scores are shared.

```
src/app.html          full app (the source you edit) — keep this private
src/free-auth.js      login / sign-up / pay code used in the free page
build.mjs             makes docs/index.html (free) and dist/app.html (full)
config.json           public settings: Supabase URL, public key, price label
supabase/             database table + 3 server functions
```

You need: a Supabase account (free plan is enough), a Stripe account, Node.js on your computer.

---

## 0. Make this repository private (important)

Until now the full app was in the public `index.html`, so anyone can still read it on GitHub, including in the history. Go to **GitHub → Settings → General → Danger zone → Change visibility → Private**.

Hosting the free page from a private repo:
- **GitHub Pages** from a private repo needs GitHub Pro. Students get Pro for free with the GitHub Student Developer Pack (education.github.com). Then **Settings → Pages → Deploy from a branch → main → /docs**.
- Or **Netlify** / **Cloudflare Pages** (free, work with private repos): connect the repo, no build command, publish directory `docs`.

Write down your site address, for example `https://siemhotting-gif.github.io/Python-App/` (with the slash at the end). Below this is called **SITE_URL**.

## 1. Supabase (accounts, database, server functions)

1. Create a project on supabase.com (region: Europe).
2. **SQL Editor → New query**: paste the contents of `supabase/migrations/20261031000000_paywall.sql` and run it. This creates the `purchases` table and the private storage bucket `app`.
3. **Authentication → URL Configuration**: set *Site URL* to your SITE_URL and add it under *Redirect URLs* too (needed for the confirm-email and reset-password links).
4. **Authentication → Sign In / Providers → Email**: keep *Confirm email* on (recommended).
5. **Project Settings → API**: copy the *Project URL* and the public key (*anon* or *publishable*) into `config.json`. Set `priceLabel` to the price you charge, e.g. `"€5"`. These two keys are public by design; never put the *service_role* / *secret* key in `config.json`.

## 2. Stripe (payment)

1. Create an account on stripe.com. During activation choose **Individual** as business type rather than a company. Stripe asks for your ID, address and a bank account for payouts. Check during sign-up whether it asks for a KvK number for your situation.
2. Stay in **Test mode** for now (toggle top right).
3. **Settings → Payment methods**: turn on **iDEAL** (and cards).
4. **Product catalogue → Add product**: "Python Practice – full access", **One-off** price, e.g. €5.00 EUR. Copy the price ID (`price_...`).
5. **Developers → API keys**: copy the secret key (`sk_test_...`).

## 3. Deploy the server functions

In a terminal in this folder:

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase functions deploy create-checkout --no-verify-jwt
npx supabase functions deploy stripe-webhook  --no-verify-jwt
npx supabase functions deploy app             --no-verify-jwt
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_ID=price_... SITE_URL=https://siemhotting-gif.github.io/Python-App/ SITE_ORIGIN=https://siemhotting-gif.github.io
```

(`--no-verify-jwt` is correct: the functions check the login themselves, and Stripe's webhook has no Supabase login.)

## 4. Stripe webhook (the "automatic" part)

1. Stripe → **Developers → Webhooks → Add endpoint**.
2. URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
3. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`.
4. Copy the **signing secret** (`whsec_...`) and run:
   `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

## 5. Build and upload

```bash
npm install
node build.mjs
```

This writes `docs/index.html` (free page) and `dist/app.html` (full app, not committed). Upload the full app to storage, either:
- in Supabase → **Storage → app** → upload `dist/app.html` as `app.html` (replace it when it exists), or
- automatically: `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key node build.mjs`

Then commit and push `docs/index.html` so your host serves the new free page.

## 6. Test

1. Open your site, create an account, confirm the email, log in, click **Pay**.
2. Pay with test card `4242 4242 4242 4242` (any future date, any CVC), or choose iDEAL and pick a test bank.
3. You return to the site, see "Payment received" and the full app opens. In Supabase → Table editor → `purchases` you see the row with `paid = true`.
4. Refund it in Stripe → the account is locked again.

When everything works: switch Stripe to **live mode**, create the same product and webhook there, and set the live `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` with `supabase secrets set`.

**Your own account without paying:** create an account on the site, then in Supabase → SQL Editor:
```sql
insert into purchases (user_id, paid) select id, true from auth.users where email = 'siemhotting@gmail.com'
on conflict (user_id) do update set paid = true;
```

## Changing the app later

Edit `src/app.html` (for example paste in the newest version from the claude.ai artifact). Keep the `// ==== AUTH START` … `// ==== AUTH END ====` block of `src/app.html` as it is. Then run `node build.mjs`, upload `dist/app.html` again, and push `docs/index.html`. If the build stops with "Not found in src/app.html", a data block was renamed and `build.mjs` needs the new name, so Modules 3–5 do not leak into the free page.

## Not built yet

- Maximum 3 devices per account (one account can now be shared by logging in elsewhere).
- Emailed receipts: turn on *Email customers about successful payments* in Stripe → Settings → Customer emails.
