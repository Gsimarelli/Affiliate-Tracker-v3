// middleware/antiFraude.js
const BOT_UA = ["bot", "crawler", "spider", "preview", "slurp", "curl",
  "wget", "python", "scrapy", "headless", "phantom", "axios", "go-http"];

function getIP(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket ? req.socket.remoteAddress : "unknown";
}

function isBot(ua) {
  const lower = (ua || "").toLowerCase();
  return BOT_UA.some((p) => lower.includes(p));
}

function validAffiliate(name) {
  return /^[a-zA-Z0-9_-]{2,50}$/.test(name || "");
}

async function isDuplicate(ip, affiliate) {
  const supabase = require("../supabase");
  if (!supabase) return false;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("clicks")
      .select("id")
      .eq("ip", ip)
      .eq("affiliate", affiliate)
      .gte("created_at", since)
      .limit(1);
    if (error) return false;
    return data && data.length > 0;
  } catch (e) {
    return false;
  }
}

async function antiFraude(req, res, next) {
  const { affiliate } = req.params;
  const ua = req.headers["user-agent"] || "";
  const ip = getIP(req);

  req.visitorIP = ip;
  req.visitorUA = ua;
  req.skipSave  = false;

  if (isBot(ua)) return res.status(403).send("Acesso negado.");
  if (!validAffiliate(affiliate)) return res.status(400).send("Nome de afiliado inválido.");

  const dup = await isDuplicate(ip, affiliate);
  if (dup) req.skipSave = true;

  next();
}

module.exports = { antiFraude };
