// middleware/antiFraude.js
// Bloqueia bots, valida nome do afiliado e evita cliques duplicados (24h).

const supabase = require("../supabase");

// Padrões de bots conhecidos no User-Agent
const BOT_UA = ["bot", "crawler", "spider", "preview", "slurp", "curl",
  "wget", "python", "scrapy", "headless", "phantom", "axios", "go-http"];

// Retorna o IP real do visitante (funciona atrás de proxy/Vercel)
function getIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket ? req.socket.remoteAddress : "unknown";
}

// Verifica se o User-Agent é de bot
function isBot(ua) {
  const lower = (ua || "").toLowerCase();
  return BOT_UA.some((p) => lower.includes(p));
}

// Valida nome do afiliado: só letras, números, hífen e underscore (2–50 chars)
function validAffiliate(name) {
  return /^[a-zA-Z0-9_-]{2,50}$/.test(name || "");
}

// Verifica no Supabase se já existe clique desse IP+afiliado nas últimas 24h
async function isDuplicate(ip, affiliate) {
  if (!supabase) return false; // sem banco, não bloqueia

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("clicks")
      .select("id")
      .eq("ip", ip)
      .eq("affiliate", affiliate)
      .gte("created_at", since)
      .limit(1);

    if (error) {
      console.error("[antiFraude] erro ao checar duplicata:", error.message);
      return false; // em caso de erro, não bloqueia o usuário real
    }
    return data && data.length > 0;
  } catch (e) {
    console.error("[antiFraude] exceção:", e.message);
    return false;
  }
}

// Middleware principal
async function antiFraude(req, res, next) {
  const { affiliate } = req.params;
  const ua = req.headers["user-agent"] || "";
  const ip = getIP(req);

  // Disponibiliza para as rotas seguintes
  req.visitorIP = ip;
  req.visitorUA = ua;
  req.skipSave = false;

  // 1. Bloqueia bots
  if (isBot(ua)) {
    return res.status(403).send("Acesso negado.");
  }

  // 2. Valida nome do afiliado
  if (!validAffiliate(affiliate)) {
    return res.status(400).send("Nome de afiliado inválido.");
  }

  // 3. Duplicata nas últimas 24h → redireciona mas não salva
  const dup = await isDuplicate(ip, affiliate);
  if (dup) {
    req.skipSave = true;
  }

  next();
}

module.exports = { antiFraude };
