// api/MAC/[id].js
export default async function handler(req, res) {
  try {
    // Get stream ID from query or path
    let streamId = req.query?.id ?? null;
    if (Array.isArray(streamId)) streamId = streamId[0];
    if (!streamId) return res.status(400).send("Missing stream id");

    streamId = String(streamId).replace(/\.m3u8$/i, "");

    // MAC portal base URL
    const macAddress = "00:1A:79:84:EB:56"; // replace with actual MAC if needed
    const sourceUrl = `http://main.light-ott.net:80/play/live.php?mac=${macAddress}&stream=${streamId}&extension=.m3u8`;

    // Fetch playlist from MAC portal
    const upstreamResp = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "curl/7.81.0",
        "Accept": "*/*",
        "Referer": "http://main.light-ott.net:80",
        "Origin": "http://main.light-ott.net:80"
      }
    });

    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      return res.status(upstreamResp.status).send(errText);
    }

    // Final URL after redirects
    const finalUrl = upstreamResp.url;
    const playlist = await upstreamResp.text();

    const u = new URL(finalUrl);
    const baseUrl = `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`;

    const isAbsolute = (s) =>
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("//") ||
      s.startsWith("data:");

    // Rewrite segment URLs to absolute paths
    const lines = playlist.split(/\r?\n/).map((ln) => {
      const t = ln.trim();
      if (!t || t.startsWith("#")) return ln;
      if (isAbsolute(t)) {
        if (t.startsWith("//")) return u.protocol + t;
        return ln;
      }
      return `${baseUrl}${t.startsWith("/") ? "" : "/"}${t}`;
    });


    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).send(lines.join("\n"));

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).send("Server error: " + (err.message || err));
  }
}
