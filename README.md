# CNV API Compatibility Tester (Render)

This is a small Express backend for testing whether the public `cnv.cx/v2/sanity/key` endpoint responds to an ordinary server-to-server request. It is **not** a working video converter and does not bypass origin restrictions.

## Endpoints
- `GET /` — service information
- `GET /health` — Render health check
- `GET /api/cnv/check` — diagnostic request to `/v2/sanity/key?id=dQw4w9WgXcQ`
- `POST /api/convert` — intentionally returns `501` until you have authorized provider documentation and a supported request schema.

## Deploy on Render
1. Upload this folder to a GitHub repository.
2. In Render choose **New → Blueprint** and select the repository, or create a Node Web Service.
3. Build command: `npm install`
4. Start command: `npm start`
5. Health check path: `/health`
6. Set `SITE_ORIGIN` to your own website origin, e.g. `https://your-site.example`. For multiple origins, separate them with commas. This controls CORS for *your own backend*; it does not grant access to cnv.cx.
7. Deploy, then open:
   - `https://YOUR-SERVICE.onrender.com/health`
   - `https://YOUR-SERVICE.onrender.com/api/cnv/check`

## Interpreting the check
- `upstreamStatus: 200`: the sanity endpoint responded to a server-side request. It does not prove converter endpoint access, 1080p availability, or permission for public use.
- `403`: provider rejected this request. Do not spoof another site's Origin/Referer to bypass that decision; request official access.
- `502`: network/timeout issue reaching the upstream service.

## Important limitations
- No `Origin` or `Referer` impersonation is used.
- No conversion job is started, no media is downloaded, and no API key is treated as a permanent credential.
- Render's free service may sleep when idle and is not suitable for guaranteed low-latency, high-volume video conversion.
- Keep secrets in Render Environment settings; never commit them to Git.
