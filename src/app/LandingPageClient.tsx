"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  trackEvent,
  readUtmFromLocation,
  STRATEGY_ID,
  LANDING_VARIANT_ID,
  type AttributionContext,
} from "@/lib/analytics";
import {
  MvpCtaFallback,
  type MvpCtaHandle,
  type MvpCtaSourceSlot,
} from "@/components/MvpCtaFallback";

// ─── Config (swap these without touching page structure) ───────────────────
// MVP fallback mode (NFDES-20260601-001): ctaUrl is intentionally not used —
// every CTA opens the unified mvp_waitlist sheet through MvpCtaFallback.
// When the real product link is available, switch CONFIG.ctaMode to "external"
// and reintroduce buildCtaUrl + window.open in handleCta.
const CONFIG = {
  ctaMode: "mvp_waitlist" as "mvp_waitlist" | "external",
  ctaUrl: "#",
  appName: "Love Keyboard",
  tagline: "AI reply coach for dating texts",
  subTagline:
    "Paste a chat screenshot, get 3 natural replies that actually sound like you.",
  // CTA labels follow the MVP CTA fallback standard (NFDES-20260601-001):
  // never imply an immediate working product; promise access/notification only.
  ctaPrimary: "Join early access",
  ctaSecondary: "Get notified when it launches",
  ctaTertiary: "Be first to try it",
  // UTM defaults (overridden by URL params at runtime)
  utmSource: "organic",
  utmMedium: "social",
  utmCampaign: "love_keyboard_launch",
  utmContent: "hero_cta",
};

const DEFAULT_UTM: AttributionContext = {
  utm_source: CONFIG.utmSource,
  utm_medium: CONFIG.utmMedium,
  utm_campaign: CONFIG.utmCampaign,
  utm_content: CONFIG.utmContent,
};

// ─── Demo data — chat screenshot → 3 reply tones ──────────────────────────
type Tone = "playful" | "warm" | "confident";

const DEMOS: Array<{
  id: string;
  label: string;
  scenarioEmoji: string;
  contextLabel: string;
  incomingMessage: string;
  outgoingDraft: string;
  replies: { tone: Tone; text: string; toneColor: string }[];
}> = [
  {
    id: "dry-text",
    label: "Dry text",
    scenarioEmoji: "💬",
    contextLabel: "Dating app · she said",
    incomingMessage: "lol",
    outgoingDraft: "yeah haha…",
    replies: [
      {
        tone: "playful",
        text: "okay, “lol” energy noted. what made you actually laugh today?",
        toneColor: "#ff5a7a",
      },
      {
        tone: "warm",
        text: "haha that’s a generous “lol.” how’s your day actually going?",
        toneColor: "#a06bff",
      },
      {
        tone: "confident",
        text: "fair. give me one thing that’s on your mind right now.",
        toneColor: "#5b8cff",
      },
    ],
  },
  {
    id: "first-opener",
    label: "First opener",
    scenarioEmoji: "🐶",
    contextLabel: "Bio: dog photo + hiking",
    incomingMessage: "matched · no message yet",
    outgoingDraft: "hey 👋",
    replies: [
      {
        tone: "playful",
        text: "your dog is doing more for your profile than you are 😅",
        toneColor: "#ff5a7a",
      },
      {
        tone: "warm",
        text: "okay the dog hike combo is dangerous. who’s the better hiker — you or them?",
        toneColor: "#a06bff",
      },
      {
        tone: "confident",
        text: "tell me one trail i should know about before i waste a weekend.",
        toneColor: "#5b8cff",
      },
    ],
  },
  {
    id: "repair",
    label: "Repair the vibe",
    scenarioEmoji: "🛠️",
    contextLabel: "Got weird after a misread joke",
    incomingMessage: "ok…",
    outgoingDraft: "wait i didn’t mean it that way, i swear i was just—",
    replies: [
      {
        tone: "playful",
        text: "yeah that came out weirder than i meant. let me try again with less of a crash landing.",
        toneColor: "#ff5a7a",
      },
      {
        tone: "warm",
        text: "i can tell that landed off. i wasn’t trying to make it weird — let’s reset?",
        toneColor: "#a06bff",
      },
      {
        tone: "confident",
        text: "that one missed. my bad. starting over: how’s your week actually going?",
        toneColor: "#5b8cff",
      },
    ],
  },
];

const TONE_LABEL: Record<Tone, string> = {
  playful: "Playful",
  warm: "Warm",
  confident: "Confident",
};

// ─── Component ────────────────────────────────────────────────────────────
export default function LandingPageClient({
  initialQuery,
}: { initialQuery?: string } = {}) {
  const [activeDemo, setActiveDemo] = useState(0);
  const utmParamsRef = useRef<AttributionContext>({});
  const [heroVisible, setHeroVisible] = useState(true);
  void initialQuery;
  const heroRef = useRef<HTMLDivElement>(null);
  const mvpCtaRef = useRef<MvpCtaHandle>(null);
  const sectionRefs = useRef<Map<string, IntersectionObserver>>(new Map());

  useEffect(() => {
    const utm = readUtmFromLocation(DEFAULT_UTM);
    utmParamsRef.current = utm;
    trackEvent("page_view", {
      ...utm,
      page: "love_keyboard_landing",
      cta_module_id: "page",
    });
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  const trackSection = useCallback((sectionId: string) => {
    if (sectionRefs.current.has(sectionId)) return;
    const el = document.getElementById(sectionId);
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent("section_exposure", {
            section_id: sectionId,
            cta_module_id: sectionId,
            ...utmParamsRef.current,
          });
          obs.disconnect();
          sectionRefs.current.delete(sectionId);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    sectionRefs.current.set(sectionId, obs);
  }, []);

  useEffect(() => {
    const sections = [
      "demo",
      "use-cases",
      "how-it-works",
      "trust",
      "faq",
      "footer-cta",
    ];
    const observers = sectionRefs.current;
    sections.forEach((s) => trackSection(s));
    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [trackSection]);

  function handleCta(label: string, ctaModuleId: string, placement: string) {
    const utm: AttributionContext = {
      ...utmParamsRef.current,
      utm_content: ctaModuleId,
      cta_module_id: ctaModuleId,
      strategy_id: STRATEGY_ID,
      landing_variant_id: LANDING_VARIANT_ID,
    };
    const eventName = ctaModuleId === "hero_cta" ? "hero_cta_click" : "cta_click";
    trackEvent(eventName, { label, placement, ...utm });
    trackEvent("product_entry_click", { label, placement, ...utm });

    if (CONFIG.ctaMode === "mvp_waitlist") {
      const slot: MvpCtaSourceSlot =
        placement === "hero"
          ? "hero"
          : placement === "sticky"
          ? "sticky"
          : placement === "footer"
          ? "footer"
          : placement === "demo"
          ? "demo"
          : "secondary";
      mvpCtaRef.current?.trigger(slot, label);
      return;
    }

    // Future: external mode (real App Store / product URL) goes here.
  }

  const demo = DEMOS[activeDemo];

  return (
    <>
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="hero" ref={heroRef} id="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="hero-badge">💌 Love Keyboard</div>
              <h1 className="hero-headline">
                Show, <span className="gradient-text">Don&apos;t Tell.</span>
              </h1>
              <p className="hero-sub">
                Paste a chat screenshot. Get 3 natural replies — playful, warm,
                or confident. Pick the one that sounds like you.
              </p>
              <div className="hero-proof">
                <div className="proof-item">
                  <span className="proof-icon">📲</span>
                  <span>Paste any chat or DM screenshot</span>
                </div>
                <div className="proof-item">
                  <span className="proof-icon">🎚️</span>
                  <span>3 tones: playful / warm / confident</span>
                </div>
                <div className="proof-item">
                  <span className="proof-icon">✨</span>
                  <span>Sound like you, only smoother</span>
                </div>
              </div>
              <button
                className="btn btn-primary btn-hero"
                onClick={() => handleCta(CONFIG.ctaPrimary, "hero_cta", "hero")}
                aria-label={CONFIG.ctaPrimary}
              >
                <span className="btn-spark" aria-hidden="true">
                  ⚡
                </span>
                {CONFIG.ctaPrimary}
              </button>
              <p className="cta-sub">
                Free reply generator · No manipulative tactics · Privacy-minded
              </p>
            </div>

            {/* Approved hero visual: mobile 9:16 / desktop 16:9 (manifest v1) */}
            <div className="hero-visual" aria-hidden="true">
              <picture>
                <source
                  media="(min-width: 768px)"
                  srcSet="/landing/hero_desktop_v1.png"
                />
                <img
                  src="/landing/hero_mobile_v1.png"
                  alt=""
                  className="hero-visual-img"
                  width={864}
                  height={1536}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </section>

        {/* ── Demo: chat → 3 replies, switch scenarios ─────────────────── */}
        <section className="demo-section" id="demo">
          <div className="section-inner">
            <h2 className="section-title">See It On a Real Chat</h2>
            <p className="section-sub">
              Pick a scenario. We&apos;ll show 3 replies you might actually send.
            </p>

            <div className="demo-tabs" role="tablist">
              {DEMOS.map((d, i) => (
                <button
                  key={d.id}
                  role="tab"
                  aria-selected={i === activeDemo}
                  className={`demo-tab ${i === activeDemo ? "active" : ""}`}
                  onClick={() => {
                    setActiveDemo(i);
                    trackEvent("demo_tab_click", {
                      demo: d.id,
                      cta_module_id: "demo_tab",
                      ...utmParamsRef.current,
                    });
                  }}
                >
                  {d.scenarioEmoji} {d.label}
                </button>
              ))}
            </div>

            <div className="demo-card" role="tabpanel">
              <div className="demo-before">
                <div className="demo-label">Their message</div>
                <div className="demo-chat">
                  <div className="chat-context small">
                    {demo.contextLabel}
                  </div>
                  <div className="bubble bubble-in">
                    {demo.incomingMessage}
                  </div>
                  <div className="bubble bubble-out bubble-stuck">
                    {demo.outgoingDraft}
                  </div>
                  <p className="demo-caption">…stuck on what to send</p>
                </div>
              </div>

              <div className="demo-arrow" aria-hidden="true">
                →
              </div>

              <div className="demo-after">
                <div className="demo-label demo-label-after">3 reply ideas</div>
                <div className="demo-replies">
                  {demo.replies.map((r) => (
                    <div className="reply-card" key={r.tone}>
                      <span
                        className="reply-tone"
                        style={{ color: r.toneColor }}
                      >
                        {TONE_LABEL[r.tone]}
                      </span>
                      <div className="reply-text">{r.text}</div>
                    </div>
                  ))}
                </div>
                <p className="demo-caption">Pick the one that sounds like you</p>
              </div>
            </div>

            <button
              className="btn btn-primary btn-demo"
              onClick={() => handleCta(CONFIG.ctaSecondary, "demo_cta", "demo")}
            >
              {CONFIG.ctaSecondary}
            </button>
          </div>
        </section>

        {/* ── Tone Cards Visual (approved manifest asset, square) ──────── */}
        <section className="tone-cards-section" id="tone-cards">
          <div className="section-inner">
            <h2 className="section-title">Three Tones, One Message</h2>
            <p className="section-sub">
              One incoming message becomes three reply cards — playful, warm,
              confident.
            </p>
            <div className="tone-cards-visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/tone_cards_v1.png"
                alt=""
                className="tone-cards-img"
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        {/* ── Use Cases ────────────────────────────────────────────────── */}
        <section className="use-cases-section" id="use-cases">
          <div className="section-inner">
            <h2 className="section-title">When People Actually Use It</h2>
            <div className="use-cases-grid">
              {[
                {
                  icon: "💘",
                  title: "First opener that doesn’t feel generic",
                  desc: "From a bio or photo, get a specific opener — not another “hey 👋”.",
                },
                {
                  icon: "🫠",
                  title: "Don’t-sound-desperate rewrite",
                  desc: "Turn a long, panicky paragraph into one calm, confident line.",
                },
                {
                  icon: "🛠️",
                  title: "Repair the vibe after a weird text",
                  desc: "Convert defensive replies into accountable, low-stakes resets.",
                },
                {
                  icon: "✨",
                  title: "Couple daily spark",
                  desc: "Better than “how was your day?” — gentle prompts that restart real talk.",
                },
              ].map((uc) => (
                <div className="use-case-card" key={uc.title}>
                  <div className="use-case-icon">{uc.icon}</div>
                  <h3 className="use-case-title">{uc.title}</h3>
                  <p className="use-case-desc">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────────────── */}
        <section className="how-section" id="how-it-works">
          <div className="section-inner">
            <h2 className="section-title">How It Works</h2>
            <div className="steps">
              {[
                {
                  num: "1",
                  icon: "📲",
                  title: "Paste the chat",
                  desc: "Drop in a screenshot or type the last message. Blur names if you’d like.",
                },
                {
                  num: "2",
                  icon: "🎚️",
                  title: "Pick a tone",
                  desc: "Playful, warm, or confident — whichever matches the vibe.",
                },
                {
                  num: "3",
                  icon: "💡",
                  title: "Get 3 replies",
                  desc: "Three different angles, each short enough to actually send.",
                },
                {
                  num: "4",
                  icon: "✉️",
                  title: "Send the one that’s you",
                  desc: "Tweak a word, hit send, move on. No copy-paste-and-pray.",
                },
              ].map((step) => (
                <div className="step" key={step.num}>
                  <div className="step-num">{step.num}</div>
                  <div className="step-icon">{step.icon}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust Block ──────────────────────────────────────────────── */}
        <section className="trust-section" id="trust">
          <div className="section-inner">
            <h2 className="section-title">What This Is — And Isn’t</h2>
            <div className="trust-grid">
              {[
                {
                  icon: "🪞",
                  title: "A tone coach, not a fake personality",
                  desc: "Reply suggestions stay in your voice. We don’t hand you a stranger’s lines.",
                },
                {
                  icon: "🧊",
                  title: "No “guaranteed” promises",
                  desc: "No “make them obsessed” claims. Just less awkward, more natural messages.",
                },
                {
                  icon: "🔒",
                  title: "Privacy-minded by default",
                  desc: "Blur names before sharing screenshots. Don’t paste anything sensitive.",
                },
                {
                  icon: "💳",
                  title: "Free reply generator",
                  desc: "No hidden trial. Any paid features — if added later — will be clearly labeled.",
                },
              ].map((t) => (
                <div className="trust-card" key={t.title}>
                  <div className="trust-icon">{t.icon}</div>
                  <h3 className="trust-title">{t.title}</h3>
                  <p className="trust-desc">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="faq-section" id="faq">
          <div className="section-inner">
            <h2 className="section-title">Common Questions</h2>
            <div className="faq-list">
              {[
                {
                  q: "Will the replies sound like AI wrote them?",
                  a: "We aim for replies you’d plausibly type yourself. They’re short, casual, and tone-matched — meant to be edited, not pasted blindly.",
                },
                {
                  q: "Does this guarantee they’ll reply?",
                  a: "No. Nobody can guarantee that. The goal is simpler: stop being stuck, send something you actually like, and keep the conversation honest.",
                },
                {
                  q: "What about my privacy if I paste screenshots?",
                  a: "Blur names and any sensitive details first. Only share what you’re comfortable with. Final data-handling details will be confirmed in-product.",
                },
                {
                  q: "Is this a relationship therapist?",
                  a: "No. It’s a communication helper for everyday texts and DMs — not therapy, not relationship advice on serious safety issues.",
                },
                {
                  q: "Can I use this for an existing partner, not just dating?",
                  a: "Yes. People use it for repair-the-vibe messages, daily spark prompts, or just rewriting something that came out wrong.",
                },
              ].map((faq) => (
                <details className="faq-item" key={faq.q}>
                  <summary className="faq-q">{faq.q}</summary>
                  <p className="faq-a">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer CTA ───────────────────────────────────────────────── */}
        <section className="footer-cta-section" id="footer-cta">
          <div className="section-inner footer-cta-inner">
            <div className="footer-cta-emoji">💌</div>
            <h2 className="footer-cta-headline">
              Stop staring at the typing dots.
            </h2>
            <p className="footer-cta-sub">
              Get 3 reply ideas. Pick the one that’s actually you. Hit send.
            </p>
            <button
              className="btn btn-primary btn-footer"
              onClick={() => handleCta(CONFIG.ctaTertiary, "footer_cta", "footer")}
            >
              {CONFIG.ctaTertiary}
            </button>
            <p className="cta-sub">
              Free reply generator · No manipulative tactics · Privacy-minded
            </p>
          </div>
        </section>

        <footer className="site-footer">
          <p>
            Love Keyboard helps you draft natural replies. It is not a
            substitute for therapy, professional relationship advice, or safety
            support.
          </p>
        </footer>
      </main>

      {/* ── Sticky Bottom CTA (shows after hero scrolls out) ─────────── */}
      <div
        className={`sticky-cta ${heroVisible ? "sticky-cta-hidden" : "sticky-cta-visible"}`}
        role="complementary"
        aria-label="Persistent call to action"
      >
        <button
          className="btn btn-primary btn-sticky"
          onClick={() => handleCta(CONFIG.ctaPrimary, "sticky_cta", "sticky")}
        >
          <span className="sticky-spark">⚡</span>
          {CONFIG.ctaPrimary}
        </button>
      </div>

      {/* ── MVP CTA Fallback overlay (NFDES-20260601-001) ─────────────── */}
      <MvpCtaFallback
        ref={mvpCtaRef}
        variantId={LANDING_VARIANT_ID}
        strategyId={STRATEGY_ID}
        getAttribution={() => utmParamsRef.current}
      />
    </>
  );
}
