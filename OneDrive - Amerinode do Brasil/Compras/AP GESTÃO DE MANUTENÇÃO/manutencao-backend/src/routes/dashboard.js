const express = require('express')
const router  = express.Router()
const { resumo } = require('../controllers/outros')
router.get('/resumo', resumo)
module.exports = router
