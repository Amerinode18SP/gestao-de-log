const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌  Variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY não definidas no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = supabase
