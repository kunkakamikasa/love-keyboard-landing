"use client";

// MVP CTA fallback: bottom-sheet on mobile, center modal on desktop, plus
// toast (mvp_interest_only) and notice (coming_soon_blocked).
// Implements NFDES-20260601-001 manifest v1.
// Hero CTA + Sticky CTA + Footer CTA must all call the same handler exposed
// from the surrounding page through the imperative ref returned by useMvpCta().

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  EMAIL_RE,
  buildMvpCtaConfig,
  type MvpCtaConfig,
  type MvpCtaStage,
} from "@/lib/mvpCta";
import {
  trackEvent,
  type AttributionContext,
} from "@/lib/analytics";

export type MvpCtaSourceSlot =
  | "hero"
  | "sticky"
  | "footer"
  | "demo"
  | "secondary";

type SheetState =
  | "closed"
  | "open"
  | "loading"
  | "success"
  | "error"
  | "blocked";

export type MvpCtaHandle = {
  /** Call from any CTA button. The handler itself emits cta_click + opens
   *  the right surface based on the configured stage.
   */
  trigger: (slot: MvpCtaSourceSlot, label?: string) => void;
};

export type MvpCtaFallbackProps = {
  variantId?: string;
  strategyId?: string;
  override?: Partial<MvpCtaConfig>;
  attribution?: AttributionContext;
  /** Read live attribution at click time (preferred over `attribution`). */
  getAttribution?: () => AttributionContext;
  /** Override the API endpoint for waitlist submission. Default: /api/waitlist */
  endpoint?: string;
};

export const MvpCtaFallback = forwardRef<MvpCtaHandle, MvpCtaFallbackProps>(
  function MvpCtaFallback(
    { variantId, strategyId, override, attribution, getAttribution, endpoint }: MvpCtaFallbackProps,
    ref
  ) {
    const config = useMemo(
      () => buildMvpCtaConfig(variantId, override),
      [variantId, override]
    );
    const stage: MvpCtaStage = config.stage;

    const [sheet, setSheet] = useState<SheetState>("closed");
    const [toastVisible, setToastVisible] = useState(false);
    const [email, setEmail] = useState("");
    const [useCase, setUseCase] = useState("");
    const [errorMsg, setErrorMsg] = useState<string>("");
    const lastSlotRef = useRef<MvpCtaSourceSlot>("hero");
    const lastLabelRef = useRef<string>("");
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);

    const open = useCallback(
      (slot: MvpCtaSourceSlot, label?: string) => {
        lastSlotRef.current = slot;
        if (label) lastLabelRef.current = label;

        const liveAttr = getAttribution ? getAttribution() : attribution || {};
        const baseAttr = {
          ...liveAttr,
          source_slot: slot,
          cta_module_id: `${slot}_cta`,
        };

        // Note: cta_click is emitted by the calling page (page-level handler
        // already records it). We only emit fallback-stage events here.

        if (stage === "mvp_waitlist") {
          setSheet("open");
          trackEvent("waitlist_open", baseAttr);
        } else if (stage === "mvp_interest_only") {
          setToastVisible(true);
          trackEvent("cta_interest_click", baseAttr);
          window.setTimeout(() => setToastVisible(false), 4000);
        } else {
          setSheet("blocked");
        }
      },
      [stage, attribution, getAttribution]
    );

    useImperativeHandle(ref, () => ({ trigger: open }), [open]);

    // ESC closes desktop modal
    useEffect(() => {
      if (sheet === "closed") return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setSheet("closed");
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [sheet]);

    // Focus close button on open for keyboard users
    useEffect(() => {
      if (sheet === "open" || sheet === "success" || sheet === "error" || sheet === "blocked") {
        closeBtnRef.current?.focus();
      }
    }, [sheet]);

    const handleClose = useCallback(() => {
      setSheet("closed");
      setErrorMsg("");
    }, []);

    const handleSubmit = useCallback(
      async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (sheet === "loading") return;

        if (!EMAIL_RE.test(email.trim())) {
          setErrorMsg("Please enter a valid email address.");
          setSheet("error");
          trackEvent("waitlist_error", {
            ...(attribution || {}),
            source_slot: lastSlotRef.current,
            reason: "invalid_email",
          });
          return;
        }

        setErrorMsg("");
        setSheet("loading");
        const liveAttr = getAttribution ? getAttribution() : attribution || {};
        trackEvent("waitlist_submit", {
          ...liveAttr,
          source_slot: lastSlotRef.current,
        });

        try {
          const res = await fetch(endpoint || config.api_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              use_case: useCase.trim() || undefined,
              source_slot: lastSlotRef.current,
              attribution: liveAttr,
              variant_id: variantId,
              strategy_id: strategyId,
              ts: new Date().toISOString(),
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.reason || "server_error");
          }
          setSheet("success");
          trackEvent("waitlist_success", {
            ...liveAttr,
            source_slot: lastSlotRef.current,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : "server_error";
          setErrorMsg(config.error_message);
          setSheet("error");
          trackEvent("waitlist_error", {
            ...liveAttr,
            source_slot: lastSlotRef.current,
            reason,
          });
        }
      },
      [
        sheet,
        email,
        useCase,
        attribution,
        getAttribution,
        variantId,
        strategyId,
        endpoint,
        config.api_endpoint,
        config.error_message,
      ]
    );

    const overlayOpen =
      sheet === "open" ||
      sheet === "loading" ||
      sheet === "success" ||
      sheet === "error" ||
      sheet === "blocked";

    return (
      <>
        {overlayOpen && (
          <div
            className="mvp-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mvp-cta-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <section className="mvp-sheet">
              <span className="mvp-sheet-grabber" aria-hidden="true" />
              <header className="mvp-sheet-head">
                <div>
                  <h2 id="mvp-cta-title" className="mvp-sheet-title">
                    {sheet === "blocked" ? config.blocked_title : config.modal_title}
                  </h2>
                  <p className="mvp-sheet-body">
                    {sheet === "success"
                      ? config.success_message
                      : sheet === "blocked"
                      ? config.blocked_body
                      : config.modal_body}
                  </p>
                </div>
                <button
                  ref={closeBtnRef}
                  className="mvp-sheet-close"
                  type="button"
                  aria-label={config.close_label}
                  onClick={handleClose}
                >
                  ×
                </button>
              </header>

              {sheet === "blocked" ? (
                <div className="mvp-sheet-actions">
                  <button
                    type="button"
                    className="mvp-sheet-submit"
                    onClick={handleClose}
                  >
                    {config.blocked_cta}
                  </button>
                </div>
              ) : sheet === "success" ? (
                <div className="mvp-sheet-actions">
                  <button
                    type="button"
                    className="mvp-sheet-submit"
                    onClick={handleClose}
                  >
                    {config.close_label}
                  </button>
                </div>
              ) : (
                <form className="mvp-sheet-form" onSubmit={handleSubmit} noValidate>
                  <input
                    className="mvp-sheet-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={config.email_placeholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={sheet === "loading"}
                    aria-label={config.email_placeholder}
                  />
                  <textarea
                    className="mvp-sheet-textarea"
                    placeholder={config.use_case_placeholder}
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    disabled={sheet === "loading"}
                    aria-label={config.use_case_placeholder}
                    rows={2}
                  />
                  <button
                    className="mvp-sheet-submit"
                    type="submit"
                    disabled={sheet === "loading"}
                  >
                    {sheet === "loading"
                      ? config.submit_loading_label
                      : config.submit_label}
                  </button>
                  {sheet === "error" && (
                    <p className="mvp-sheet-error" role="alert">
                      {errorMsg || config.error_message}
                    </p>
                  )}
                  <p className="mvp-sheet-microcopy">{config.microcopy}</p>
                </form>
              )}
            </section>
          </div>
        )}

        {toastVisible && (
          <div className="mvp-toast" role="status" aria-live="polite">
            {config.toast_message}
          </div>
        )}
      </>
    );
  }
);
