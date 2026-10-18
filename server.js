import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = Number(process.env.PORT || 10000);
const CNV_BASE_URL = (process.env.CNV_BASE_URL || "https://cnv.cx").replace(/\/+$/, "");
const CNV_KEY_PATH = process.env.CNV_KEY_PATH || "/v2/sanity/key";
const SITE_ORIGIN = process.env.SITE_ORIGIN || "";
const REQUEST_TIMEOUT_MS = Math.min(Number(process.env.REQUEST_TIMEOUT_MS || 10000), 20000);

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "16kb" }));

const allowedOrigins = SITE_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // No Origin is expected for server-to-server diagnostic requests.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by this backend"), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.get("/", (_req, res) => res.json({
  service: "CNV API compatibility tester",
  status: "ok",
  endpoints: ["/health", "/api/cnv/check"],
  note: "This service does not bypass provider authorization or impersonate another Origin."
}));

app.get("/health", (_req, res) => res.status(200).json({
  ok: true,
  service: "cnv-api-compatibility-test",
  timestamp: new Date().toISOString()
}));

app.get("/api/cnv/check", async (_req, res) => {
  const videoId = "dQw4w9WgXcQ";
  const url = new URL(CNV_KEY_PATH, CNV_BASE_URL);
  url.searchParams.set("id", videoId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();

  try {
    // Server-to-server request intentionally does not forge an Origin/Referer.
    const upstream = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    const raw = await upstream.text();
    let body;
    try { body = JSON.parse(raw); } catch { body = { nonJsonResponse: raw.slice(0, 500) }; }

    res.status(200).json({
      ok: upstream.ok,
      diagnostic: "sanity-key-endpoint",
      upstreamStatus: upstream.status,
      elapsedMs: Date.now() - started,
      accessControlAllowOrigin: upstream.headers.get("access-control-allow-origin"),
      result: upstream.ok
        ? "Endpoint responded to a server-side request. This does not prove that /v2/converter is authorized or usable."
        : "Provider rejected or failed the request. Check official API access/authorization.",
      response: sanitize(body)
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      diagnostic: "sanity-key-endpoint",
      elapsedMs: Date.now() - started,
      error: error.name === "AbortError" ? "Upstream request timed out" : "Could not reach upstream endpoint",
      detail: process.env.NODE_ENV === "production" ? undefined : String(error.message || error)
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.post("/api/convert", (_req, res) => {
  // The provider's supported request schema and permission are not established.
  // Avoid exposing an unverified proxy or impersonating another site.
  res.status(501).json({
    ok: false,
    error: "Converter integration is not configured",
    message: "This starter intentionally does not call /v2/converter until you have the provider's authorized API documentation, request schema, and permission for your domain."
  });
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origin not allowed by this backend") {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }
  console.error("Request error:", err?.message || err);
  return res.status(500).json({ ok: false, error: "Internal server error" });
});

function sanitize(value) {
  if (value && typeof value === "object") {
    const out = Array.isArray(value) ? [] : {};
    for (const [key, item] of Object.entries(value)) {
      // Avoid returning any future credential-like fields from an upstream response.
      if (/token|secret|password|authorization/i.test(key)) continue;
      out[key] = sanitize(item);
    }
    return out;
  }
  if (typeof value === "string") return value.slice(0, 1000);
  return value;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
