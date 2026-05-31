// Typed analytics helper for love_keyboard landing.
// Mirrors the event schema demanded by APPDEV-D-20260531-002:
// every event carries strategy_id + landing_variant_id + cta_module_id + base_video_id +
// platform + published_asset_id so downstream attribution can join across GA4 and Vercel.

export const STRATEGY_ID = "love_keyboard_direction_strategy_v1";
export const LANDING_VARIANT_ID = "love_keyboard_h5_v1";

export type EventName =
  | "page_view"
  | "section_exposure"
  | "cta_click"
  | "hero_cta_click"
  | "product_entry_click"
  | "demo_tab_click";

export type AttributionContext = {
  // utm passthrough
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  // funnel attribution
  strategy_id?: string;
  landing_variant_id?: string;
  cta_module_id?: string;
  base_video_id?: string;
  platform?: string;
  published_asset_id?: string;
};

export type EventParams = AttributionContext & Record<string, string | number | boolean | undefined>;

type WindowWithAnalytics = typeof window & {
  gtag?: (...args: unknown[]) => void;
  va?: (...args: unknown[]) => void;
  vam?: (...args: unknown[]) => void;
};

function getDefaultContext(): AttributionContext {
  return {
    strategy_id: STRATEGY_ID,
    landing_variant_id: LANDING_VARIANT_ID,
    // base_video_id / cta_module_id / platform / published_asset_id are
    // populated per-event by the caller; sent as empty strings when unknown
    // so the schema column stays present in GA4/Vercel for joining.
    base_video_id: "",
    cta_module_id: "",
    platform: "",
    published_asset_id: "",
  };
}

function sanitize(params: EventParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out[k] = v as string | number | boolean;
  }
  return out;
}

export function trackEvent(event: EventName, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  const merged = sanitize({ ...getDefaultContext(), ...params });

  try {
    const w = window as WindowWithAnalytics;
    if (typeof w.gtag === "function") {
      w.gtag("event", event, merged);
    }
    // Vercel Analytics custom events
    if (typeof w.va === "function") {
      w.va("event", { name: event, data: merged });
    }
    // dev visibility
    if (typeof console !== "undefined") {
      console.log("[analytics]", event, merged);
    }
  } catch {
    // analytics must never break the page
  }
}

export function readUtmFromLocation(
  fallback: AttributionContext = {}
): AttributionContext {
  if (typeof window === "undefined") return fallback;
  const sp = new URLSearchParams(window.location.search);
  return {
    utm_source: sp.get("utm_source") || fallback.utm_source,
    utm_medium: sp.get("utm_medium") || fallback.utm_medium,
    utm_campaign: sp.get("utm_campaign") || fallback.utm_campaign,
    utm_content: sp.get("utm_content") || fallback.utm_content,
    base_video_id: sp.get("base_video_id") || fallback.base_video_id,
    cta_module_id: sp.get("cta_module_id") || fallback.cta_module_id,
    platform: sp.get("platform") || fallback.platform,
    published_asset_id: sp.get("published_asset_id") || fallback.published_asset_id,
  };
}

export function buildCtaUrl(
  base: string,
  attribution: AttributionContext
): string {
  if (!base || base === "#") return "#";
  try {
    const url = new URL(base);
    const passthroughKeys: (keyof AttributionContext)[] = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "strategy_id",
      "landing_variant_id",
      "cta_module_id",
      "base_video_id",
      "platform",
      "published_asset_id",
    ];
    passthroughKeys.forEach((k) => {
      const v = attribution[k];
      if (v) url.searchParams.set(k, v);
    });
    return url.toString();
  } catch {
    return base;
  }
}
