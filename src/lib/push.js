import { supabase } from "./supabase";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Este navegador não suporta Web Push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificação não concedida.");

  const registration = await navigator.serviceWorker.ready;

  const res = await fetch("/api/vapid-public-key");
  if (!res.ok) throw new Error("VAPID não configurado no servidor.");
  const { publicKey } = await res.json();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login antes de ativar as notificações.");

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });

  if (error) throw error;
  return true;
}
