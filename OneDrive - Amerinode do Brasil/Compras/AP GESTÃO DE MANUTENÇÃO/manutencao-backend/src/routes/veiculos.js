// ── routes/veiculos.js ──────────────────────────────────────────────────────
const express  = require('express')
const router   = express.Router()
const { listarVeiculos, revisoesPendentes } = require('../controllers/outros')

router.get('/',         listarVeiculos)
router.get('/revisoes', revisoesPendentes)

module.exports = router
