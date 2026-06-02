// api/BDIX/[id].js
export default async function handler(req, res) {
  try {
    // Get ID from URL (either /api/BDIX/244978.m3u8 or ?id=244978)
    let id = req.query?.id ?? null;
    if (Array.isArray(id)) id = id[0];
    if (!id && typeof req.query === "object") id = req.query.id;
    if (!id) return res.status(400).send("Missing stream id");

    // Strip ".m3u8" if present
    id = String(id).replace(/\.m3u8$/i, "");

    // Xtream Codes base URL (your source)
    const baseXtream = "http://euro-deluxe.com:8080/live/DanielvAngeloCast/e3u3dSd7hyUFK/";
    const sourceUrl = `${baseXtream}/${id}.m3u8`;

    // Fetch upstream with curl-like headers
    const upstreamResp = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "curl/7.81.0", // mimic PHP curl
        "Accept": "*/*",
        "Referer": "http://euro-deluxe.com",
        "Origin": "http://euro-deluxe.com"
      }
    });

    // Handle errors (debug mode)
    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      const errHeaders = Object.fromEntries(upstreamResp.headers.entries());

      console.error("⚠️ Upstream error", upstreamResp.status, errHeaders, errText);

      return res.status(upstreamResp.status).send(
        `Upstream returned ${upstreamResp.status}\n\n` +
        `--- HEADERS ---\n${JSON.stringify(errHeaders, null, 2)}\n\n` +
        `--- BODY ---\n${errText}`
      );
    }

    // Final resolved URL (after redirects)
    const finalUrl = upstreamResp.url;
    if (!finalUrl) return res.status(500).send("Failed to resolve redirect.");

    let playlist = await upstreamResp.text();

    // Build base URL (scheme://host[:port])
    const u = new URL(finalUrl);
    const baseUrl = `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;

    const isAbsolute = (s) =>
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("//") ||
      s.startsWith("data:");

    // Replace URIs inside quotes (like URI="key.key", init.mp4, ts, etc.)
    playlist = playlist.replace(
      /(["'])([^"']+\.(?:ts|m4s|mp4|key|aac|m3u8)(?:\?[^"']*)?)\1/gi,
      (match, quote, url) => {
        if (isAbsolute(url)) {
          if (url.startsWith("//")) return `${quote}${u.protocol}${url}${quote}`;
          return `${quote}${url}${quote}`;
        }
        return `${quote}${baseUrl}${url.startsWith("/") ? "" : "/"}${url}${quote}`;
      }
    );

    // Fix plain segment lines (not starting with #)
    const lines = playlist.split(/\r?\n/).map((ln) => {
      const t = ln.trim();
      if (!t || t.startsWith("#")) return ln;
      if (isAbsolute(t)) {
        if (t.startsWith("//")) return u.protocol + t;
        return ln;
      }
      return `${baseUrl}${t.startsWith("/") ? "" : "/"}${t}`;
    });

    const finalPlaylist = lines.join("\n");

    // Send result
   
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).send(finalPlaylist);

  } catch (err) {
    console.error("⚠️ Server error", err);
    return res.status(500).send("Server error: " + (err.message || err));
  }
}
