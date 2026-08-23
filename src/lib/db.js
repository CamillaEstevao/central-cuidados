import { supabase } from "./supabase";

export async function list(table, orderBy, ascending = true) {
  let q = supabase.from(table).select("*");
  if (orderBy) q = q.order(orderBy, { ascending });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insert(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function update(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
