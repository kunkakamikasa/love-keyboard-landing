// MVP CTA fallback config + standard copy.
// Implements NFDES-20260601-001 manifest v1 (mvp_waitlist / mvp_interest_only / coming_soon_blocked).
// Default direction here: love_keyboard. Other directions can override copy via the
// `directionOverride` argument when mounting <MvpCtaFallback />.

import type { AttributionContext } from "@/lib/analytics";

export type MvpCtaStage =
  | "mvp_waitlist"
  | "mvp_interest_only"
  | "coming_soon_blocked";

export type MvpCtaConfig = {
  stage: MvpCtaStage;
  cta_label_primary: string;
  cta_label_secondary: string;
  modal_title: string;
  modal_body: string;
  email_placeholder: string;
  use_case_placeholder: string;
  submit_label: string;
  submit_loading_label: string;
  success_message: string;
  error_message: string;
  close_label: string;
  microcopy: string;
  toast_label: string;
  toast_message: string;
  blocked_title: string;
  blocked_body: string;
  blocked_cta: string;
  api_endpoint: string;
};

const STANDARD: MvpCtaConfig = {
  stage: "mvp_waitlist",
  cta_label_primary: "Join early access",
  cta_label_secondary: "Get notified when it launches",
  modal_title: "Get early access when it’s ready",
  modal_body:
    "We’re testing interest in this idea. Leave your email and we’ll notify you when the first version is available.",
  email_placeholder: "Email address",
  use_case_placeholder: "What would you use this for?",
  submit_label: "Notify me",
  submit_loading_label: "Sending...",
  success_message:
    "You’re on the list. We’ll email you when early access opens.",
  error_message: "Something went wrong. Please try again in a moment.",
  close_label: "Close",
  microcopy:
    "No fake App Store links. No empty buttons. UTM is passed into the submission and analytics event.",
  toast_label: "I’m interested",
  toast_message:
    "Thanks — this concept is not live yet. We’re using early interest to decide what to build first.",
  blocked_title: "Coming soon",
  blocked_body: "This concept isn’t ready yet. Please check back later.",
  blocked_cta: "Check back soon",
  api_endpoint: "/api/waitlist",
};

// Direction overrides keyed by landing_variant_id.
const DIRECTION_OVERRIDES: Record<string, Partial<MvpCtaConfig>> = {
  love_keyboard_h5_v1: {
    modal_title: "Get the Love Keyboard waitlist invite when it opens",
    modal_body:
      "We’re testing demand for an AI reply coach for dating texts. Leave your email and we’ll notify you when early access opens.",
    use_case_placeholder:
      "Who do you mostly text — match, partner, or someone you’re crushing on? (optional)",
  },
};

export function buildMvpCtaConfig(
  variantId?: string,
  override: Partial<MvpCtaConfig> = {}
): MvpCtaConfig {
  const dir = variantId ? DIRECTION_OVERRIDES[variantId] ?? {} : {};
  return { ...STANDARD, ...dir, ...override };
}

export type WaitlistSubmitPayload = {
  email: string;
  use_case?: string;
  source_slot: "hero" | "sticky" | "footer" | "demo" | "secondary";
  attribution: AttributionContext;
  variant_id?: string;
  strategy_id?: string;
  ts: string;
};

export type WaitlistSubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid_email" | "rate_limited" | "server_error" };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
