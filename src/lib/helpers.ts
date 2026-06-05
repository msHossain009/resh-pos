import { createClient } from "./supabase/client";
import type { BusinessSettings, UserProfile } from "./types";

export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .single();
  return data;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Check if a role has permission for an action */
export function can(role: string | undefined, action: "create" | "edit" | "delete" | "view_reports" | "manage_settings"): boolean {
  switch (action) {
    case "create":
      return role === "admin" || role === "manager" || role === "cashier";
    case "edit":
      return role === "admin" || role === "manager";
    case "delete":
      return role === "admin";
    case "view_reports":
      return role === "admin" || role === "manager";
    case "manage_settings":
      return role === "admin";
    default:
      return false;
  }
}
