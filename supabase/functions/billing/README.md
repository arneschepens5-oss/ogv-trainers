Edge function `billing` (Mollie): POST /checkout (beheerder start eerste betaling) en POST /webhook (Mollie meldt betaling).
Secrets: MOLLIE_API_KEY (test_... tot de club live gaat), optioneel BILLING_PRICE (bv. 29.00) en SITE_URL.
De volledige broncode staat in Supabase (functie `billing`).
