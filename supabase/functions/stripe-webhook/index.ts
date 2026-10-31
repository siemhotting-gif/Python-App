// Stripe calls this after a payment. A verified, paid Checkout Session unlocks the account;
// a full refund locks it again. Deploy with --no-verify-jwt (Stripe sends no Supabase token).
import { admin } from "../_shared/util.ts";
import { verifyStripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const body = await req.text();
  const ok = await verifyStripe(body, req.headers.get("Stripe-Signature"), Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  if (!ok) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(body);
  const obj = event.data.object;
  const db = admin().from("purchases");

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const userId = obj.client_reference_id ?? obj.metadata?.user_id;
    if (obj.payment_status === "paid" && userId) {
      const { error } = await db.upsert({
        user_id: userId,
        paid: true,
        stripe_session_id: obj.id,
        stripe_payment_intent: obj.payment_intent,
        amount_total: obj.amount_total,
        currency: obj.currency,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error(error);
        return new Response("Database error", { status: 500 }); // Stripe retries later
      }
    }
  } else if (event.type === "charge.refunded" && obj.refunded && obj.payment_intent) {
    await db.update({ paid: false, updated_at: new Date().toISOString() }).eq("stripe_payment_intent", obj.payment_intent);
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
