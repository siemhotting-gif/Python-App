// Sends the full app (Storage bucket "app", file "app.html") only to logged-in users who paid.
import { admin, cors, getUser, isPaid, json } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return json({ error: "Not logged in" }, 401);
  if (!(await isPaid(user.id))) return json({ error: "Not paid" }, 402);

  const { data, error } = await admin().storage.from("app").download("app.html");
  if (error || !data) {
    console.error(error);
    return json({ error: "App file missing" }, 500);
  }
  return new Response(await data.text(), {
    headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
});
