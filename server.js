// server.js
require("dotenv").config();

const express  = require("express");
const path     = require("path");
const supabase = require("./supabase");

const authRouter      = require("./routes/auth");
const redirectRouter  = require("./routes/redirect");
const dashboardRouter = require("./routes/dashboard");
const requireAuth     = require("./middleware/requireAuth");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("trust proxy", true);

// ── Diagnóstico ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    variaveis: {
      SUPABASE_URL:      process.env.SUPABASE_URL      ? "✅ definida" : "❌ FALTANDO",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "✅ definida" : "❌ FALTANDO",
      ADMIN_PASSWORD:    process.env.ADMIN_PASSWORD    ? "✅ definida" : "❌ FALTANDO",
      WHATSAPP_URL:      process.env.WHATSAPP_URL      ? "✅ definida" : "❌ FALTANDO",
      JWT_SECRET:        process.env.JWT_SECRET        ? "✅ definida" : "❌ FALTANDO",
    },
    node: process.version,
  });
});

// ── Auth (cadastro / login) ───────────────────────────────────
app.use("/auth", authRouter);

// ── Área do usuário (API protegida por JWT) ───────────────────
app.use("/api", dashboardRouter);

// ── Rastreamento de afiliados ─────────────────────────────────
app.use("/a", redirectRouter);

// ── Página de login/cadastro ──────────────────────────────────
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ── Área do usuário (página) ──────────────────────────────────
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ── Painel admin (login) ──────────────────────────────────────
app.get("/admin", (req, res) => {
  const senha   = req.query.senha;
  const correta = process.env.ADMIN_PASSWORD;

  if (!correta) {
    return res.status(500).send("Variável ADMIN_PASSWORD não configurada.");
  }
  if (senha !== correta) {
    return res.status(401).send(`
      <!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Admin — Login</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,sans-serif;background:#0f0f0f;color:#fff;
             display:flex;align-items:center;justify-content:center;min-height:100vh}
        .box{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;
             padding:40px;width:100%;max-width:360px;text-align:center}
        h2{margin-bottom:8px} p{color:#888;margin-bottom:28px;font-size:.9rem}
        input{width:100%;padding:12px;background:#111;border:1px solid #333;
              border-radius:8px;color:#fff;font-size:1rem;margin-bottom:14px;outline:none}
        input:focus{border-color:#25D366}
        button{width:100%;padding:12px;background:#25D366;color:#000;border:none;
               border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer}
        .err{color:#f55;font-size:.85rem;margin-top:10px}
      </style></head><body>
      <div class="box">
        <h2>🔒 Painel Admin</h2>
        <p>Digite a senha para acessar</p>
        <form method="GET" action="/admin">
          <input type="password" name="senha" placeholder="Senha" autofocus required />
          <button type="submit">Entrar</button>
        </form>
        ${senha !== undefined ? '<p class="err">Senha incorreta.</p>' : ''}
      </div></body></html>
    `);
  }
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ── API admin: estatísticas de cliques ────────────────────────
app.get("/api/stats", async (req, res) => {
  if (req.query.senha !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Não autorizado." });
  }
  if (!supabase) return res.status(500).json({ erro: "Supabase não configurado." });

  try {
    let query = supabase
      .from("clicks")
      .select("affiliate, ip, created_at")
      .order("created_at", { ascending: false });

    if (req.query.de) query = query.gte("created_at", new Date(req.query.de).toISOString());
    if (req.query.ate) {
      const fim = new Date(req.query.ate);
      fim.setHours(23, 59, 59, 999);
      query = query.lte("created_at", fim.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const contagem = {};
    (data || []).forEach(({ affiliate }) => {
      contagem[affiliate] = (contagem[affiliate] || 0) + 1;
    });
    const ranking = Object.entries(contagem)
      .map(([affiliate, total]) => ({ affiliate, total }))
      .sort((a, b) => b.total - a.total);

    res.json({ total: (data || []).length, ranking, cliques: data || [] });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── API admin: listar usuários ────────────────────────────────
app.get("/api/admin/users", async (req, res) => {
  if (req.query.senha !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Não autorizado." });
  }
  if (!supabase) return res.status(500).json({ erro: "Supabase não configurado." });

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, affiliate, pix_key, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ users: data || [] });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── API admin: listar todos os pagamentos ─────────────────────
app.get("/api/admin/payments", async (req, res) => {
  if (req.query.senha !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Não autorizado." });
  }
  if (!supabase) return res.status(500).json({ erro: "Supabase não configurado." });

  try {
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, description, status, created_at, user_id, users(email, affiliate)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ payments: data || [] });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── API admin: registrar pagamento ────────────────────────────
app.post("/api/admin/payments", async (req, res) => {
  if (req.query.senha !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Não autorizado." });
  }
  if (!supabase) return res.status(500).json({ erro: "Supabase não configurado." });

  const { user_id, amount, description, status } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({ erro: "user_id e amount são obrigatórios." });
  }

  try {
    const { data, error } = await supabase
      .from("payments")
      .insert([{
        user_id:     Number(user_id),
        amount:      Number(amount),
        description: description || "",
        status:      status || "pendente",
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ payment: data });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── API admin: atualizar status de pagamento ──────────────────
app.patch("/api/admin/payments/:id", async (req, res) => {
  if (req.query.senha !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Não autorizado." });
  }
  if (!supabase) return res.status(500).json({ erro: "Supabase não configurado." });

  const { status } = req.body;
  if (!["pendente", "pago"].includes(status)) {
    return res.status(400).json({ erro: "Status deve ser 'pendente' ou 'pago'." });
  }

  try {
    const { data, error } = await supabase
      .from("payments")
      .update({ status })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ payment: data });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── Raiz ──────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "✅ online",
    login:   "Acesse /login para entrar ou criar conta",
    admin:   "Acesse /admin para o painel administrativo",
    health:  "Acesse /health para checar variáveis de ambiente",
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

// ── Erro global ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[erro global]", err.message);
  res.status(500).json({ erro: "Erro interno." });
});

// ── Inicia servidor local ─────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
}

module.exports = app;
