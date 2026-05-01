// routes/fornecedores.js
const express = require('express')
const router  = express.Router()
const { listarFornecedores } = require('../controllers/outros')
router.get('/', listarFornecedores)
module.exports = router
