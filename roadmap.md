# Roadmap

- [x] Fix "supabase url is required" on Vercel deploy (env vars + fallback)
- [x] Ticket purchase: choose quantity, show summed total, proceed to pay
- [x] Rotating upcoming-events strip (pauses on tap/hover, links to event)
- [x] Answer: how the site survives high traffic during ticket sales
- [x] Admin: organizers/admins, events, tickets, price phases, expiry (already built — confirm)
- [x] M-Pesa STK checkout (needs Daraja consumer key/secret)
- [x] Add Paystack checkout alongside M-Pesa and verify payment callbacks before issuing tickets
- [x] Buyer email/WhatsApp fields, delivery tracking, and ticket download
- [ ] Email sending: waiting on the user's sender domain
- [ ] WhatsApp sending: waiting on connecting WhatsApp Business in this workspace (connect card declined)
- [x] Confirm the user wants to migrate to the separately supplied database project
- [ ] Export Lovable Cloud data, import it into the destination, then configure the app with destination credentials; waiting on the user's export/import and secure credentials
