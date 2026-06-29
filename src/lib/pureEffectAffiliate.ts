const PE_UTM = {
  utm_source: "ancora",
  utm_medium: "affiliate",
  utm_campaign: "ancora_main",
} as const;

export function toPureEffectAffiliateUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    Object.entries(PE_UTM).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  } catch {
    return null;
  }
}
