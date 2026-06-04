"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0],
        });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (!mounted) return null;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {user && (
          <>
            <div className="hidden sm:flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gold/20 text-gold dark:bg-gold-dark/20 dark:text-gold-dark text-xs">
                  {(user.name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground/80 max-w-[120px] truncate">
                {user.name || user.email}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full">
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
