// routes/dashboard.js

const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const supabase = require("../supabase");

// =============================
// GET /api/me
// =============================
router.get("/me", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ erro: "Supabase não configurado." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, email, affiliate, pix_key, created_at")
      .eq("id", req.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const BASE_URL = process.env.BASE_URL || "";

    return res.json({
      id: data.id,
      email: data.email,
      affiliate: data.affiliate,
      pix_key: data.pix_key,
      created_at: data.created_at,
      link: `${BASE_URL}/a/${data.affiliate}`
    });

  } catch (e) {
    console.error("[api/me]", e.message);
    res.status(500).json({ erro: e.message });
  }
});

// =============================
// GET /api/me/payments
// =============================
router.get("/me/payments", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ erro: "Supabase não configurado." });
    }

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, description, status, created_at")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ erro: error.message });
    }

    return res.json({
      payments: data ?? []
    });

  } catch (e) {
    console.error("[api/me/payments]", e.message);
    res.status(500).json({ erro: e.message });
  }
});

// =============================
// GET /api/me/clicks
// =============================
router.get("/me/clicks", requireAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ erro: "Supabase não configurado." });
    }

    const { data, error } = await supabase
      .from("clicks")
      .select("id, created_at")
      .eq("affiliate", req.userAffiliate)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ erro: error.message });
    }

    const clicks = data ?? [];

    return res.json({
      total: clicks.length,
      clicks
    });

  } catch (e) {
    console.error("[api/me/clicks]", e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
