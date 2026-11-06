# Kale Nation Events

Do a research about Kale Nation(Club Hosting | Pre-weddings | Weddings | Corporate Events | Marketing & Branding.) I would like to build a powerful website that will handle high traffic without crash. I have attached image for logo, loading animation i a runner image showing lightning while running, everything is animated with high caching power fo image loading also displays content at a high ms rate. This website should be in a position to have different programs like kutit culture, simbafest and many more. This programs are owned by people, such that kale nation will help these owners to get their tickets onl;ine and also market thier brand. The programs should be able to operate independently, where the owner can be granted super admin priviledges to help them post their events, edit the ticket and prices at any given time while giving timeline for tickets to expire, and also automate tickets to rewrite the price at a certain time. tickets must have a watermark of the event, QRcode, and other special ticketing decorations. I would like to build this mockup because i want to secure a contract with them

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c1062ad2-08ff-44f1-8c5a-f1b592ba9ece).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Ticket checkout: Paystack and M-Pesa

The checkout uses the existing `ticket_orders` table and the Drizzle migration history. Before enabling payment:

1. Apply pending migrations in order using the project's migration workflow. Locally, set `LOVABLE_DB_MIGRATION_URL` in a private environment and run `npx drizzle-kit migrate`. For the existing ticket schema, migrations `0002_ticket_delivery_paystack.sql` and `0003_ticket_order_security.sql` add the payment/delivery fields and reservation RPC without dropping ticket tables or orders. Do not use the migration URL as an application runtime variable.
2. In the deployment environment, configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key server-only; never use a `VITE_*` name for it.
3. Configure Paystack's server-only `PAYSTACK_SECRET_KEY` and set its webhook URL to `https://events.v-soft-innovations.com/api/public/paystack/webhook`.
4. Configure M-Pesa Daraja's `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, and `MPESA_PASSKEY` as encrypted server-side variables. Set `MPESA_ENVIRONMENT=sandbox` while testing and `MPESA_ENVIRONMENT=production` only after Daraja approval. `MPESA_TRANSACTION_TYPE` may be `CustomerPayBillOnline` or `CustomerBuyGoodsOnline`. Set `MPESA_CALLBACK_URL` to `https://events.v-soft-innovations.com/api/public/mpesa/callback` or let it be derived from `APP_BASE_URL`; either URL must use HTTPS. The sandbox shortcode/passkey defaults are for sandbox testing only.
5. Set `APP_BASE_URL=https://events.v-soft-innovations.com` for Paystack return URLs. Run sandbox transactions and test duplicate callbacks, cancelled payments, and inventory limits before enabling live checkout.

Ticket reservations and provider-attempt limits are enforced server-side. Paystack transactions are verified against Paystack's API; M-Pesa callbacks are checked against Daraja's STK Query before tickets are issued. Mismatched or inventory-constrained confirmed payments are marked for manual refund review. Order/ticket data is accessed server-side with the service-role client, and payment responses are not cached.

Ticket delivery is manual: after payment verification, buyers can share their issued ticket details and the public event link through WhatsApp. Payment/order IDs are not included in the share link. Do not store provider credentials in SQL function source, client variables, or chat.
