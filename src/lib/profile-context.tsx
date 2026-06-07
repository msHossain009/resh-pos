"use client";

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";

interface ProfileContextValue { profile: UserProfile | null; loading: boolean; }

const ProfileContext = createContext<ProfileContextValue>({ profile: null, loading: true });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const ensureProfile = useCallback(async (userId: string, userEmail: string | undefined) => {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (existing) {
      setProfile(existing);
      return;
    }

    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: userEmail || null,
        email: userEmail || null,
        role: "cashier",
        active: true,
      })
      .select()
      .single();

    if (newProfile) {
      setProfile(newProfile);
      return;
    }

    const { data: retry } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(retry || null);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await ensureProfile(user.id, user.email ?? undefined);
      }
      setLoading(false);
    })();
  }, [supabase, ensureProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
