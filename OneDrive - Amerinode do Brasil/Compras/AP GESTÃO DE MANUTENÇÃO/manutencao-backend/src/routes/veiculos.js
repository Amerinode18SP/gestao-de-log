// ── routes/veiculos.js ──────────────────────────────────────────────────────
const express  = require('express')
const router   = express.Router()
const { listarVeiculos, revisoesPendentes, atualizarVeiculo } = require('../controllers/outros')

router.get('/',         listarVeiculos)
router.get('/revisoes', revisoesPendentes)
router.put('/:id',      atualizarVeiculo)

module.exports = router
