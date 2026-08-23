import webpush from "web-push";
import { adminSupabase } from "./_supabase.js";

const TIMEZONE = "America/Sao_Paulo";

/**
 * Converte uma data + hora cadastrada no horário de São Paulo
 * para um Date UTC correto.
 *
 * Exemplo:
 * 2026-08-23 + 20:56 em São Paulo
 * vira aproximadamente 2026-08-23T23:56:00Z
 */
function saoPauloDateTime(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);

  // Primeiro criamos uma referência UTC.
  const guess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second)
  );

  // Descobrimos como esse instante aparece em São Paulo.
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

    /*
     * Aceitamos avisos que deveriam ter sido enviados
     * até 10 minutos atrás.
     *
     * Também verificamos os próximos 16 minutos.
     *
     * Assim uma pequena demora na execução não faz
     * o sistema perder a notificação.
     */
    const windowStart = new Date(
      now.getTime() - 10 * 60 * 1000
    );

    const windowEnd = new Date(
      now.getTime() + 16 * 60 * 1000
    );

    const { data: reminders, error: remErr } =
      await supabase
        .from("reminders")
        .select("*")
        .eq("status", "pending")
        .eq("notification_sent", false);

    if (remErr) throw remErr;

    const { data: appointments, error: appErr } =
      await supabase
        .from("appointments")
        .select("*")
        .eq("status", "upcoming")
        .eq("notification_sent", false);

    if (appErr) throw appErr;

    const due = [];

    // -------------------------
    // LEMBRETES
    // -------------------------

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
          table: "reminders",
          item: r,
          notifyAt,
          title: "🔔 Lembrete",
          body: r.title,
          url: "/"
        });
      }
    }

    // -------------------------
    // CONSULTAS
    // -------------------------

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

    let sent = 0;
    let failed = 0;

    const results = [];

    // -------------------------
    // ENVIO PUSH
    // -------------------------

    for (const d of due) {
      const { data: subscriptions, error: subError } =
        await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", d.item.user_id);

      if (subError) {
        failed++;

        results.push({
          id: d.item.id,
          type: d.table,
          sent: 0,
          error: subError.message
        });

        continue;
      }

      let sentForThisItem = 0;

      for (const subscription of subscriptions || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
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

          /*
           * 404 / 410 significa que a assinatura
           * daquele aparelho não é mais válida.
           */
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

      /*
       * Só marcamos como enviado se pelo menos
       * um aparelho realmente recebeu o push.
       *
       * Se não houver assinatura, continua false
       * para poder tentar novamente.
       */
      if (sentForThisItem > 0) {
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

      results.push({
        id: d.item.id,
        type: d.table,
        scheduledFor:
          d.notifyAt.toISOString(),
        sent: sentForThisItem
      });
    }

    return res.status(200).json({
      ok: true,
      timezone: TIMEZONE,
      serverTime: now.toISOString(),
      windowStart:
        windowStart.toISOString(),
      windowEnd:
        windowEnd.toISOString(),
      due: due.length,
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