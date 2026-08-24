import webpush from "web-push";
import { adminSupabase } from "./_supabase.js";

const TIMEZONE = "America/Sao_Paulo";

function saoPauloDateTime(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);

  const guess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second)
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(guess)
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );

  const representedAsUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  const desiredAsUTC = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  const offset = representedAsUTC - guess.getTime();

  return new Date(desiredAsUTC - offset);
}

function saoPauloToday(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default async function handler(req, res) {
  try {
    const supabase = adminSupabase();

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject =
      process.env.VAPID_SUBJECT || "mailto:admin@example.com";

    if (!publicKey || !privateKey) {
      return res.status(500).json({
        error: "VAPID não configurado."
      });
    }

    webpush.setVapidDetails(
      subject,
      publicKey,
      privateKey
    );

    const now = new Date();

    const windowStart = new Date(
      now.getTime() - 10 * 60 * 1000
    );

    const windowEnd = new Date(
      now.getTime() + 16 * 60 * 1000
    );

    // =========================
    // LEMBRETES
    // =========================

    const { data: reminders, error: remErr } =
      await supabase
        .from("reminders")
        .select("*")
        .eq("status", "pending")
        .eq("notification_sent", false);

    if (remErr) throw remErr;

    // =========================
    // CONSULTAS
    // =========================

    const { data: appointments, error: appErr } =
      await supabase
        .from("appointments")
        .select("*")
        .eq("status", "upcoming")
        .eq("notification_sent", false);

    if (appErr) throw appErr;

    // =========================
    // MEDICAMENTOS
    // =========================

    const { data: medications, error: medErr } =
      await supabase
        .from("medications")
        .select("*");

    if (medErr) throw medErr;

    const due = [];

    // =========================
    // VERIFICAR LEMBRETES
    // =========================

    for (const r of reminders || []) {
      if (!r.due_date || !r.due_time) continue;

      const when = saoPauloDateTime(
        r.due_date,
        r.due_time
      );

      const minutesBefore =
        Number(r.remind_minutes_before) || 0;

      const notifyAt = new Date(
        when.getTime() -
        minutesBefore * 60 * 1000
      );

      if (
        notifyAt >= windowStart &&
        notifyAt <= windowEnd
      ) {
        due.push({
          type: "reminder",
          table: "reminders",
          item: r,
          notifyAt,
          title: "🔔 Lembrete",
          body: r.title,
          url: "/"
        });
      }
    }

    // =========================
    // VERIFICAR CONSULTAS
    // =========================

    for (const a of appointments || []) {
      if (!a.date || !a.time) continue;

      const when = saoPauloDateTime(
        a.date,
        a.time
      );

      const minutesBefore =
        Number(a.remind_minutes_before) || 0;

      const notifyAt = new Date(
        when.getTime() -
        minutesBefore * 60 * 1000
      );

      if (
        notifyAt >= windowStart &&
        notifyAt <= windowEnd
      ) {
        due.push({
          type: "appointment",
          table: "appointments",
          item: a,
          notifyAt,
          title: "📅 Consulta agendada",
          body:
            `${a.title} • ` +
            `${a.date} às ${String(a.time).slice(0, 5)}`,
          url: "/"
        });
      }
    }

    // =========================
    // VERIFICAR MEDICAMENTOS
    // =========================

    const todaySP = saoPauloToday(now);

    for (const m of medications || []) {
      const schedule =
        Array.isArray(m.schedule)
          ? m.schedule
          : [];

      for (const time of schedule) {
        if (!time) continue;

        const notifyAt =
          saoPauloDateTime(todaySP, time);

        if (
          notifyAt < windowStart ||
          notifyAt > windowEnd
        ) {
          continue;
        }

        const scheduledAt =
          notifyAt.toISOString();

        // Verifica se esse medicamento
        // já teve aviso nesse horário hoje.
        const {
          data: alreadySent,
          error: checkError
        } = await supabase
          .from("medication_notification_logs")
          .select("id")
          .eq("medication_id", m.id)
          .eq("scheduled_at", scheduledAt)
          .limit(1);

        if (checkError) throw checkError;

        if (
          alreadySent &&
          alreadySent.length > 0
        ) {
          continue;
        }

        due.push({
          type: "medication",
          item: m,
          notifyAt,
          scheduledAt,
          title: "💊 Hora do medicamento",
          body:
            `${m.name}` +
            `${m.dose ? ` • ${m.dose}` : ""}`,
          url: "/"
        });
      }
    }

    let sent = 0;
    let failed = 0;

    const results = [];

    // =========================
    // ENVIAR NOTIFICAÇÕES
    // =========================

    for (const d of due) {
      const {
        data: subscriptions,
        error: subError
      } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", d.item.user_id);

      if (subError) {
        failed++;

        results.push({
          id: d.item.id,
          type: d.type,
          sent: 0,
          error: subError.message
        });

        continue;
      }

      let sentForThisItem = 0;

      for (
        const subscription
        of subscriptions || []
      ) {
        try {
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.p256dh,

                auth:
                  subscription.auth
              }
            },

            JSON.stringify({
              title: d.title,
              body: d.body,
              url: d.url
            })
          );

          sent++;
          sentForThisItem++;

        } catch (error) {
          failed++;

          if (
            error.statusCode === 404 ||
            error.statusCode === 410
          ) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq(
                "endpoint",
                subscription.endpoint
              );
          }

          console.error(
            "Erro ao enviar push:",
            error.statusCode,
            error.message
          );
        }
      }

      // =========================
      // REGISTRAR COMO ENVIADO
      // =========================

      if (sentForThisItem > 0) {

        // MEDICAMENTO
        if (d.type === "medication") {

          const { error: logError } =
            await supabase
              .from(
                "medication_notification_logs"
              )
              .insert({
                user_id:
                  d.item.user_id,

                medication_id:
                  d.item.id,

                medication_name:
                  d.item.name,

                scheduled_at:
                  d.scheduledAt,

                sent_at:
                  new Date().toISOString()
              });

          if (logError) {
            console.error(
              "Erro ao registrar aviso:",
              logError.message
            );
          }

        }

        // LEMBRETE / CONSULTA
        else {

          const { error: updateError } =
            await supabase
              .from(d.table)
              .update({
                notification_sent: true
              })
              .eq("id", d.item.id);

          if (updateError) {
            console.error(
              "Erro ao marcar notificação:",
              updateError.message
            );
          }
        }
      }

      results.push({
        id: d.item.id,
        type: d.type,
        scheduledFor:
          d.notifyAt.toISOString(),
        sent: sentForThisItem
      });
    }

    return res.status(200).json({
      ok: true,
      timezone: TIMEZONE,
      serverTime:
        now.toISOString(),

      windowStart:
        windowStart.toISOString(),

      windowEnd:
        windowEnd.toISOString(),

      due:
        due.length,

      sent,

      failed,

      results
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}