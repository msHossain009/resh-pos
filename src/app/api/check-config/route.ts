import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const issues: string[] = [];
  const info: Record<string, string> = {};

  if (!url) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  } else {
    info.url_length = String(url.length);
    info.url_starts_https = url.startsWith("https://") ? "yes" : "NO — missing https://";
    info.url_ends_supabase = url.includes("supabase.co") ? "yes" : "unusual domain";

    if (!url.startsWith("http")) {
      issues.push("Supabase URL must start with https://");
    }
    if (url.endsWith("/")) {
      issues.push("Supabase URL should not end with a slash");
    }
  }

  if (!key) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  } else {
    info.key_length = String(key.length);
    info.key_format = key.startsWith("eyJ") ? "valid JWT format" : "unusual format (should start with eyJ)";
  }

  info.site_url = siteUrl || "not set (your Vercel URL is default)";

  return NextResponse.json({
    status: issues.length === 0 ? "ok" : "issues_found",
    issues,
    info,
    fix: "Go to https://vercel.com/mshossain009/resh-pos/settings/environment-variables and verify the values. Supabase URL should be like: https://xxxxxxxxxxxxxxxxxxxx.supabase.co (with https://, no trailing slash)",
  });
}
