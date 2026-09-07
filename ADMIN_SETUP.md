# Pompkin Admin Setup

1. Upload/replace the website files in GitHub as usual.
2. Open Supabase SQL Editor.
3. Run `supabase_admin_setup.sql`.
4. Make sure your own Pompkin account already exists.
5. In Supabase SQL Editor, run this once, replacing the email:

   insert into public.admin_users (user_id)
   select id from auth.users
   where lower(email) = lower('YOUR-GMAIL-HERE')
   on conflict do nothing;

6. Visit:
   `https://pompkin-art.github.io/Pompkin/admin.html`

Only accounts listed in `admin_users` can use the dashboard.

The dashboard can currently:
- add/edit products
- upload product pictures
- set price
- set weight in grams
- set stock
- set sold count
- set category/author/keywords/description
- hide products
- review customer reviews
- approve/reject/delete reviews

Do not put a Supabase secret/service key in the website.
