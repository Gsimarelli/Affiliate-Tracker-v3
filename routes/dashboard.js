// routes/dashboard.js
// Rotas da área do usuário (todas protegidas por JWT).
//
// GET  /api/me           → dados do usuário logado
// GET  /api/me/payments  → pagamentos registrados pelo admin para este usuário
// GET  /api/me/clicks    → total de cliques do afiliado

const express     = require("express");
const router      = express.Router();
const requireAuth = require("../middleware/requireAuth");
const supabase    = require("../supabase");

// ── GET /api/me ──────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Banco não configurado." });

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, affiliate, pix_key, created_at")
      .eq("id", req.userId)
      .single();

    if (error || !data) return res.status(404).json({ erro: "Usuário não encontrado." });

    const baseUrl = process.env.BASE_URL || "";
    res.json({
      id:         data.id,
      email:      data.email,
      affiliate:  data.affiliate,
      pix_key:    data.pix_key,
      created_at: data.created_at,
      link:       `${baseUrl}/a/${data.affiliate}`,
    });
  } catch (e) {
    console.error("[api/me]", e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/me/payments ─────────────────────────────────────
router.get("/me/payments", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Banco não configurado." });

  try {
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, description, status, created_at")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ payments: data || [] });
  } catch (e) {
    console.error("[api/me/payments]", e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/me/clicks ───────────────────────────────────────
router.get("/me/clicks", requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Banco não configurado." });

  try {
    const { data, error } = await supabase
      .from("clicks")
      .select("id, created_at")
      .eq("affiliate", req.userAffiliate)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ total: (data || []).length, clicks: data || [] });
  } catch (e) {
    console.error("[api/me/clicks]", e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
