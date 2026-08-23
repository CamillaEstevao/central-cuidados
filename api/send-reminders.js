import webpush from "web-push";
import { adminSupabase } from "./_supabase.js";

export default async function handler(req, res) {
  try {
    const supabase = adminSupabase();

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!publicKey || !privateKey) return res.status(500).json({ error: "VAPID não configurado." });

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);

    const { data: reminders, error: remErr } = await supabase
      .from("reminders")
      .select("*")
      .eq("status","pending")
      .eq("notification_sent",false);

    if (remErr) throw remErr;

    const { data: appointments, error: appErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("status","upcoming")
      .eq("notification_sent",false);

    if (appErr) throw appErr;

    const due = [];

    for (const r of reminders || []) {
      if (!r.due_time) continue;
      const when = new Date(`${r.due_date}T${r.due_time}`);
      const notifyAt = new Date(when.getTime() - (r.remind_minutes_before || 0) * 60000);
      if (notifyAt >= now && notifyAt <= windowEnd) {
        due.push({ table:"reminders", item:r, title:"Lembrete", body:r.title, url:"/" });
      }
    }

    for (const a of appointments || []) {
      if (!a.time) continue;
      const when = new Date(`${a.date}T${a.time}`);
      const notifyAt = new Date(when.getTime() - (a.remind_minutes_before || 0) * 60000);
      if (notifyAt >= now && notifyAt <= windowEnd) {
        due.push({ table:"appointments", item:a, title:"Consulta agendada", body:`${a.title} • ${a.date} ${a.time}`, url:"/" });
      }
    }

    let sent = 0;
    for (const d of due) {
      const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", d.item.user_id);
      for (const s of subs || []) {
        try {
          await webpush.sendNotification({
            endpoint:s.endpoint,
            keys:{ p256dh:s.p256dh, auth:s.auth }
          }, JSON.stringify({ title:d.title, body:d.body, url:d.url }));
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
      await supabase.from(d.table).update({ notification_sent:true }).eq("id", d.item.id);
    }

    res.status(200).json({ ok:true, due:due.length, sent });
  } catch (e) {
    res.status(500).json({ error:e.message });
  }
}
