// Supabase Edge Function: submit-request
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
Deno.serve(async (req) => {
 if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
 if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
 try {
  const body = await req.json();
  const name = String(body.name || "").trim(), link = String(body.link || "").trim(), category = String(body.category || "").trim(), description = String(body.description || "").trim();
  if (!name || name.length > 80 || !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(link) || !category || !description || description.length > 500) return Response.json({ error: "Data tidak valid." }, { status: 400, headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  const { error } = await db.from("group_requests").insert({ name, link, category, description, status: "pending" });
  if (error) throw error;
  const resendKey = Deno.env.get("RESEND_API_KEY"), adminEmail = Deno.env.get("ADMIN_EMAIL"), fromEmail = Deno.env.get("FROM_EMAIL");
  if (resendKey && adminEmail && fromEmail) {
   const mail = await fetch("https://api.resend.com/emails", { method:"POST", headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type":"application/json" }, body: JSON.stringify({ from: fromEmail, to: [adminEmail], subject: `Request grup baru: ${name}`, html: `<h2>Request grup baru</h2><p><b>Nama:</b> ${name.replace(/[&<>]/g,"")}</p><p><b>Kategori:</b> ${category.replace(/[&<>]/g,"")}</p><p><b>Deskripsi:</b> ${description.replace(/[&<>]/g,"")}</p><p><a href="${link}">Buka link WhatsApp</a></p><p>Masuk ke dashboard admin untuk menyetujui atau menolak.</p>` }) });
   if (!mail.ok) console.error("Email notification failed", await mail.text());
  }
  return Response.json({ ok: true }, { headers: cors });
 } catch (e) { console.error(e); return Response.json({ error: "Server gagal memproses request." }, { status: 500, headers: cors }); }
});￼Enter
