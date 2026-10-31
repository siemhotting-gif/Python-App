// Starts a Stripe Checkout payment for the logged-in user and returns the payment page URL.
import { cors, getUser, isPaid, json } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Please log in again." }, 401);
  if (await isPaid(user.id)) return json({ paid: true });

  const site = Deno.env.get("SITE_URL")!; // e.g. https://siemhotting-gif.github.io/Python-App/
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": Deno.env.get("STRIPE_PRICE_ID")!,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "metadata[user_id]": user.id,
    "payment_intent_data[metadata][user_id]": user.id,
    success_url: `${site}?paid=1`,
    cancel_url: `${site}?cancel=1`,
    locale: "auto",
  });
  if (user.email) form.set("customer_email", user.email);

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const session = await r.json();
  if (!r.ok) {
    console.error("Stripe error", session);
    return json({ error: "Could not start the payment. Try again later." }, 502);
  }
  return json({ url: session.url });
});
