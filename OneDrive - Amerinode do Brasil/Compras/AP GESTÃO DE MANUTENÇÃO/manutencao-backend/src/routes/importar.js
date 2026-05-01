const express = require('express')
const multer  = require('multer')
const router  = express.Router()
const { importar } = require('../controllers/importar')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') ||
               file.mimetype.includes('excel') ||
               file.originalname.endsWith('.xlsx') ||
               file.originalname.endsWith('.csv')
    cb(ok ? null : new Error('Apenas arquivos .xlsx e .csv são aceitos'), ok)
  }
})

router.post('/', upload.single('arquivo'), importar)

module.exports = router
