export async function api(path, options={}) {
  const res = await fetch(`/api${path}`, {
    headers: {"Content-Type":"application/json", ...(options.headers||{})},
    ...options
  });
  if (!res.ok) {
    let message = "Erro na requisição";
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}
