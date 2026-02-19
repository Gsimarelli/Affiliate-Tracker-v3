// middleware/requireAuth.js
// Verifica o token JWT enviado pelo frontend.
// Uso: adicionar como middleware em rotas protegidas.

const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ erro: "Não autenticado. Faça login." });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ erro: "JWT_SECRET não configurado no servidor." });
  }

  try {
    const payload = jwt.verify(token, secret);
    req.userId   = payload.id;
    req.userEmail = payload.email;
    req.userAffiliate = payload.affiliate;
    next();
  } catch (e) {
    return res.status(401).json({ erro: "Sessão expirada ou inválida. Faça login novamente." });
  }
}

module.exports = requireAuth;
