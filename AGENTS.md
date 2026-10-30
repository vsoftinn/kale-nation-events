<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data lives in Lovable Cloud tables (programs, events, ticket_tiers, price_phases, posts, organizer_applications); public pages read via server fns in src/lib/public.functions.ts — keeps SSR fast and RLS-safe.
- Pricing rules stay pure in src/lib/pricing.ts with tests — reused on server and client.
- Roles in user_roles (superadmin/admin); admins scoped to programs via program_admins + can_manage_program() RLS — admins only touch their own program.
- Public signup is off; logins are created only by the super admin (src/lib/admin.functions.ts). First super admin is created on /auth only while none exists.
- Admin portal is /admin (unlinked, noindex) under the _authenticated gate.
- Auto-posting: /api/public/jobs/auto-posts (daily cron) drafts event posts + one AI news post as 'pending'; super admin approves before publish.
