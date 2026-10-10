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

- Keep submission creation and resubmission validation in database triggers and the participant RPC; this prevents direct client calls from bypassing event closure or manual review.
- Share a short-lived TanStack Query cache across the app; it reduces redundant requests during navigation without leaving event data stale for long.
- Keep organizer media browsing behind the admin route and existing row/storage policies; private proofs must never become publicly readable.
- Keep the group chat in its own authenticated route with database-enforced author validation and admin-only hiding; this prevents forged messages and unauthorized moderation.
- Share challenge proofs in chat only after explicit participant opt-in and organizer approval; use a filtered database read and short-lived access instead of making the private proofs bucket public.
- Review direct messages only through an authenticated server function that verifies the admin role and server-held password on every request, rate-limits failures and audits reads; never widen participant RLS or persist the unlock in browser storage.
- Store uploaded profile photos as avatar-prefixed object paths in a separate private bucket; the shared AvatarImage resolves cached signed links so every participant surface displays the same photo without exposing challenge proofs.
- Read other participants' biographies through the authenticated bio-only RPC, not broader profile access; this keeps private profile fields protected.
