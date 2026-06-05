function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (typeof window === "undefined") {
      throw new Error(
        `Missing required environment variable: ${name}\n` +
          `Set it in your .env.local file or Vercel project settings.`
      );
    }
    return "";
  }
  return value;
}

export const env = {
  supabaseUrl: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

export function validateEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Environment validation failed — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
}
