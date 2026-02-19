// supabase.js
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("[supabase] AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não definidos.");
}

const supabase = (url && key) ? createClient(url, key) : null;

module.exports = supabase;
