# Roadmap

- [x] Fix "supabase url is required" on Vercel deploy (env vars + fallback)
- [x] Ticket purchase: choose quantity, show summed total, proceed to pay
- [x] Rotating upcoming-events strip (pauses on tap/hover, links to event)
- [x] Answer: how the site survives high traffic during ticket sales
- [x] Admin: organizers/admins, events, tickets, price phases, expiry (already built — confirm)
- [x] M-Pesa STK checkout (needs Daraja consumer key/secret)
- [ ] Add Paystack checkout alongside M-Pesa and verify payment callbacks before issuing tickets
- [ ] Add buyer email and WhatsApp ticket delivery with safe delivery tracking
- [ ] Clarify whether to migrate this app from Lovable Cloud to the separately supplied database project; requires project keys and migration approval
- [ ] Connect the supplied external database project before continuing the new-workspace WhatsApp setup; URL alone is insufficient
- [ ] Connect WhatsApp Business in the new workspace after the database decision
