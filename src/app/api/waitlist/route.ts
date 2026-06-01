// Waitlist submission endpoint for MVP CTA fallback (NFDES-20260601-001).
//
// Storage adapter precedence:
//  1. Vercel KV (env: KV_REST_API_URL + KV_REST_API_TOKEN) — appended to a list
//     `mvp:waitlist:<variantId|default>` plus a JSON record under
//     `mvp:waitlist:item:<uuid>`.
//  2. Local JSONL file at MVP_WAITLIST_LOG_PATH or /tmp/mvp_waitlist.jsonl
//     (works in dev; ephemeral on Vercel — used only when KV is unset).
//  3. Always: structured console.log so logs/analytics retain the record.
//
// Endpoint always validates email server-side and rate-limits per IP via a
// simple in-memory token bucket (best-effort; replace with KV-backed limiter
// later without changing the response shape).

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RawBody = {
  email?: unknown;
  use_case?: unknown;
  source_slot?: unknown;
  attribution?: unknown;
  variant_id?: unknown;
  strategy_id?: unknown;
  ts?: unknown;
};

type WaitlistRecord = {
  id: string;
  ts: string;
  email: string;
  use_case?: string;
  source_slot: string;
  variant_id?: string;
  strategy_id?: string;
  attribution: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
};

// In-process per-IP rate limiter: 5 req / 60s.
const RL = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const win = 60_000;
  const cap = 5;
  const cur = RL.get(ip);
  if (!cur || cur.reset < now) {
    RL.set(ip, { count: 1, reset: now + win });
    return false;
  }
  cur.count += 1;
  return cur.count > cap;
}

async function storeKv(record: WaitlistRecord): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return false;
  const variant = record.variant_id || "default";
  const itemKey = `mvp:waitlist:item:${record.id}`;
  const listKey = `mvp:waitlist:${variant}`;
  try {
    await fetch(`${url}/set/${encodeURIComponent(itemKey)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });
    await fetch(
      `${url}/lpush/${encodeURIComponent(listKey)}/${encodeURIComponent(record.id)}`,
      { method: "POST", headers: { Authorization: `Bearer ${tok}` } }
    );
    return true;
  } catch {
    return false;
  }
}

async function storeFile(record: WaitlistRecord): Promise<boolean> {
  const path = process.env.MVP_WAITLIST_LOG_PATH || "/tmp/mvp_waitlist.jsonl";
  try {
    await fs.appendFile(path, JSON.stringify(record) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: RawBody;
  try {
    body = (await req.json()) as RawBody;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_json" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { ok: false, reason: "invalid_email" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429 }
    );
  }

  const record: WaitlistRecord = {
    id: randomUUID(),
    ts:
      typeof body.ts === "string" && body.ts ? body.ts : new Date().toISOString(),
    email,
    use_case:
      typeof body.use_case === "string" && body.use_case.trim()
        ? body.use_case.trim().slice(0, 500)
        : undefined,
    source_slot:
      typeof body.source_slot === "string" ? body.source_slot : "unknown",
    variant_id:
      typeof body.variant_id === "string" ? body.variant_id : undefined,
    strategy_id:
      typeof body.strategy_id === "string" ? body.strategy_id : undefined,
    attribution:
      body.attribution && typeof body.attribution === "object"
        ? (body.attribution as Record<string, unknown>)
        : {},
    ip,
    user_agent: req.headers.get("user-agent") || undefined,
  };

  console.log("[mvp_waitlist]", JSON.stringify(record));

  const stored = (await storeKv(record)) || (await storeFile(record));
  if (!stored) {
    return NextResponse.json({ ok: true, persisted: "log_only" });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST { email, use_case?, source_slot, attribution, variant_id?, strategy_id?, ts? }",
  });
}
