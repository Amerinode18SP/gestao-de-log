// ── routes/ordens.js ────────────────────────────────────────────────────────
const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/ordens')

router.get   ('/',            ctrl.listar)
router.get   ('/:id',         ctrl.buscarPorId)
router.post  ('/',            ctrl.criar)
router.put   ('/:id',         ctrl.atualizar)
router.delete('/:id',         ctrl.excluir)
router.patch ('/:id/status',  ctrl.atualizarStatus)

module.exports = router
