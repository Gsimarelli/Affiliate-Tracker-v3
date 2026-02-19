// routes/auth.js
// POST /auth/register → cria conta
// POST /auth/login    → retorna token JWT

const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const supabase = require("../supabase");

// Valida nome de afiliado: letras, números, hífen, underscore (2–30 chars)
function validAffiliate(name) {
  return /^[a-zA-Z0-9_-]{2,30}$/.test(name || "");
}

// Valida e-mail básico
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

// ── POST /auth/register ──────────────────────────────────────
router.post("/register", async (req, res) => {
  const { email, password, pix_key, affiliate } = req.body;

  // Validações
  if (!email || !password || !pix_key || !affiliate) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  }
  if (!validEmail(email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (password.length < 6) {
    return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
  }
  if (!validAffiliate(affiliate)) {
    return res.status(400).json({
      erro: "Nome de afiliado inválido. Use apenas letras, números, hífen ou underscore (2–30 caracteres)."
    });
  }
  if (!supabase) {
    return res.status(500).json({ erro: "Banco de dados não configurado." });
  }

  try {
    // Verifica se e-mail já existe
    const { data: existingEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .limit(1);

    if (existingEmail && existingEmail.length > 0) {
      return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    }

    // Verifica se nome de afiliado já existe
    const { data: existingAffiliate } = await supabase
      .from("users")
      .select("id")
      .eq("affiliate", affiliate.toLowerCase().trim())
      .limit(1);

    if (existingAffiliate && existingAffiliate.length > 0) {
      return res.status(409).json({ erro: "Este nome de afiliado já está em uso. Escolha outro." });
    }

    // Hash da senha
    const password_hash = await bcrypt.hash(password, 10);

    // Insere usuário
    const { data, error } = await supabase
      .from("users")
      .insert([{
        email:         email.toLowerCase().trim(),
        password_hash,
        pix_key:       pix_key.trim(),
        affiliate:     affiliate.toLowerCase().trim(),
      }])
      .select("id, email, affiliate")
      .single();

    if (error) throw error;

    // Gera token JWT
    const token = jwt.sign(
      { id: data.id, email: data.email, affiliate: data.affiliate },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, affiliate: data.affiliate });

  } catch (e) {
    console.error("[auth/register]", e.message);
    res.status(500).json({ erro: "Erro ao criar conta: " + e.message });
  }
});

// ── POST /auth/login ─────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  }
  if (!supabase) {
    return res.status(500).json({ erro: "Banco de dados não configurado." });
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, password_hash, affiliate")
      .eq("email", email.toLowerCase().trim())
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    const ok = await bcrypt.compare(password, data.password_hash);
    if (!ok) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    const token = jwt.sign(
      { id: data.id, email: data.email, affiliate: data.affiliate },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, affiliate: data.affiliate });

  } catch (e) {
    console.error("[auth/login]", e.message);
    res.status(500).json({ erro: "Erro ao fazer login: " + e.message });
  }
});

module.exports = router;
