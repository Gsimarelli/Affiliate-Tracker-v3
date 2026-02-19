// routes/redirect.js
const express = require("express");
const router  = express.Router();
const { antiFraude } = require("../middleware/antiFraude");

const WHATSAPP = process.env.WHATSAPP_URL ||
  "https://whatsapp.com/channel/0029VbCQT8DAjPXVvtDq7213";

router.get("/:affiliate", antiFraude, async (req, res) => {
  const affiliate = req.params.affiliate.toLowerCase();
  const ip = req.visitorIP;
  const ua = req.visitorUA;

  if (!req.skipSave) {
    const supabase = require("../supabase");
    if (!supabase) {
      console.error("[redirect] Supabase não disponível.");
    } else {
      try {
        const { error } = await supabase
          .from("clicks")
          .insert([{ affiliate, ip, user_agent: ua }]);
        if (error) console.error("[redirect] erro ao inserir:", error.message);
        else console.log(`[redirect] clique salvo: ${affiliate} | ${ip}`);
      } catch (e) {
        console.error("[redirect] exceção:", e.message);
      }
    }
  }

  res.redirect(302, WHATSAPP);
});

module.exports = router;
