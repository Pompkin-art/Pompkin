# Checkout + Voucher Update

The new dedicated `order-checkout.html` is not in the site navigation.

It includes:
- saved full name
- saved mobile number
- saved full shipping address
- custom optional "Buy me a coffee?" amount with no preset value
- shipping fee in the total
- private voucher code validation through Supabase
- voucher management in the admin dashboard

Run the updated `supabase_admin_setup.sql` in Supabase before using vouchers.
