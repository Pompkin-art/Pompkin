# Pompkin username login setup

The website files now use usernames for the email/password login flow.

There are two small Supabase setup steps because Supabase Auth itself signs in with an email/password internally:

## 1. Run the SQL

Open **Supabase → SQL Editor → New query**.

Copy everything from `supabase_username_setup.sql` into the SQL editor and click **Run**.

This creates the private `profiles` table and automatically stores the username entered during signup.

## 2. Deploy the Edge Function

The folder `supabase/functions/login-with-username/` contains the function that securely converts a username + password login into a normal Supabase Auth session.

Deploy it as a Supabase Edge Function named:

`login-with-username`

The function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`; that secret is never placed in the website.

After deployment, the Pompkin login page can authenticate using the username field.

## Important

Do not put a Supabase secret/service-role key into any HTML, JavaScript, GitHub Pages file, or public repository.

The website only contains the publishable key.
