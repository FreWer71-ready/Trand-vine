// Adminåtgärder på användarkonton som kräver Supabases admin-API.
//   POST { "action": "delete", "userId": "…" } med adminens inloggning (JWT)
// Kontot tas bort i Supabase Auth; profil, flaskor och betyg försvinner med det
// (on delete cascade). Viner och streckkoder användaren lagt till finns kvar.
// Man kan inte ta bort sig själv eller en annan admin.

import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Användarens id ur JWT:n. Signaturen är redan kontrollerad av Supabase (verify_jwt). */
function userId(req: Request): string | null {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "authenticated" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const isAdmin = async (id: string) => {
  const [row] = await sql`
    select exists (select 1 from auth.users u join private.admin_emails a on a.email = lower(u.email)
                   where u.id = ${id} and u.email_confirmed_at is not null) as ok`;
  return row?.ok === true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const caller = userId(req);
  if (!caller || !(await isAdmin(caller))) return json({ error: "admin_only" }, 403);

  const body = await req.json().catch(() => ({}));
  if (body.action === "delete" && typeof body.userId === "string" && /^[0-9a-f-]{36}$/i.test(body.userId)) {
    if (body.userId === caller) return json({ error: "cannot_delete_self" }, 400);
    if (await isAdmin(body.userId)) return json({ error: "cannot_delete_admin" }, 400);
    const { error } = await admin.auth.admin.deleteUser(body.userId);
    if (error) return json({ error: error.message }, 500);
    return json({ deleted: body.userId });
  }
  return json({ error: "unknown_action" }, 400);
});
