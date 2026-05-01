# 🚗 API — Sistema de Gestão de Manutenção Veicular

Backend REST em **Node.js + Express** com banco de dados **PostgreSQL via Supabase**,
pronto para deploy no **Railway**.

---

## 📁 Estrutura do Projeto

```
manutencao-backend/
├── src/
│   ├── server.js                  # Entrada da aplicação
│   ├── supabase.js                # Cliente Supabase
│   ├── controllers/
│   │   ├── ordens.js              # CRUD de ordens
│   │   ├── outros.js              # Veículos, fornecedores, dashboard
│   │   └── importar.js            # Importação Excel/CSV
│   └── routes/
│       ├── ordens.js
│       ├── veiculos.js
│       ├── fornecedores.js
│       ├── dashboard.js
│       └── importar.js
├── scripts/
│   ├── schema.sql                 # Schema do banco (rodar no Supabase)
│   └── seed.js                   # Dados de exemplo
├── .env.example
├── railway.toml
└── package.json
```

---

## 🗺️ Endpoints da API

### Ordens de Compra
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ordens` | Listar ordens (suporta filtros) |
| GET | `/api/ordens/:id` | Buscar ordem por ID |
| POST | `/api/ordens` | Criar nova ordem |
| PUT | `/api/ordens/:id` | Atualizar ordem |
| DELETE | `/api/ordens/:id` | Excluir ordem |
| PATCH | `/api/ordens/:id/status` | Atualizar só o status |

**Filtros disponíveis no GET `/api/ordens`:**
```
?status=Pendente
?categoria=Serviço
?origem=Cotabox
?data_inicio=2025-01-01&data_fim=2025-04-30
?page=1&limit=50
```

### Veículos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/veiculos` | Listar veículos |
| GET | `/api/veiculos/revisoes?dias=30` | Revisões pendentes |

### Fornecedores
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/fornecedores` | Listar fornecedores |

### Dashboard
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard/resumo?periodo=mes` | Totais do período |

Períodos: `mes` · `3m` · `6m` · `trim` · `ano`

### Importação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/importar` | Upload de .xlsx ou .csv |

Enviar como `multipart/form-data` com campo `arquivo`.

---

## 🚀 Passo a passo para colocar no ar

### ETAPA 1 — Criar o banco no Supabase (5 min)

1. Acesse **https://supabase.com** e crie uma conta gratuita
2. Clique em **New Project** → dê um nome → escolha região **South America (São Paulo)**
3. Aguarde o projeto inicializar (~2 min)
4. No menu lateral, vá em **SQL Editor → New query**
5. Cole todo o conteúdo do arquivo `scripts/schema.sql` e clique **Run**
6. Vá em **Settings → API** e copie:
   - `Project URL` → será o `SUPABASE_URL`
   - `anon public` → será o `SUPABASE_ANON_KEY`
   - `service_role` → será o `SUPABASE_SERVICE_KEY`

---

### ETAPA 2 — Publicar o código no GitHub (3 min)

```bash
# Na pasta do projeto
git init
git add .
git commit -m "primeiro commit"

# Crie um repositório no github.com e depois:
git remote add origin https://github.com/SEU_USUARIO/manutencao-veicular-api.git
git push -u origin main
```

---

### ETAPA 3 — Deploy no Railway (5 min)

1. Acesse **https://railway.app** e faça login com GitHub
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione o repositório que você criou
4. Railway detecta o Node.js automaticamente e inicia o build
5. Vá em **Variables** e adicione:

```
SUPABASE_URL        = https://xxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_KEY= eyJ...
NODE_ENV            = production
FRONTEND_URL        = *
```

6. Vá em **Settings → Networking → Generate Domain**
7. Sua API estará em: `https://manutencao-xxx.up.railway.app`

---

### ETAPA 4 — Testar (2 min)

```bash
# Health check
curl https://SEU-DOMINIO.up.railway.app/health

# Listar ordens
curl https://SEU-DOMINIO.up.railway.app/api/ordens

# Criar ordem
curl -X POST https://SEU-DOMINIO.up.railway.app/api/ordens \
  -H "Content-Type: application/json" \
  -d '{
    "placa": "ABC-1234",
    "localidade": "São Paulo",
    "supervisor": "João Silva",
    "nota_fiscal": "00123",
    "data_ordem": "2025-04-30",
    "categoria": "Serviço",
    "item": "Troca de óleo",
    "valor_item": 250,
    "quantidade": 1,
    "fornecedor": "Auto Peças Ltda",
    "cnpj": "12.345.678/0001-90"
  }'
```

---

### ETAPA 5 — Inserir dados de exemplo (opcional)

```bash
# Na máquina local com o .env preenchido:
npm run seed
```

---

### ETAPA 6 — Conectar o frontend

No sistema web (o HTML/JS que já temos), substitua as chamadas locais pela URL da API.
Exemplo de como chamar do frontend:

```javascript
const API = 'https://SEU-DOMINIO.up.railway.app'

// Buscar ordens
const res  = await fetch(`${API}/api/ordens?periodo=mes`)
const data = await res.json()

// Criar ordem
await fetch(`${API}/api/ordens`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ placa, localidade, ...campos })
})

// Importar Excel
const form = new FormData()
form.append('arquivo', arquivoInput.files[0])
await fetch(`${API}/api/importar`, { method: 'POST', body: form })
```

---

## 🔧 Desenvolvimento local

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e preencher o .env
cp .env.example .env

# 3. Rodar em modo desenvolvimento (hot-reload)
npm run dev

# 4. API disponível em http://localhost:3000
```

---

## 📌 Próximos passos sugeridos

- [ ] Autenticação com login (Supabase Auth já está incluso no projeto)
- [ ] Integração com API do Cotabox
- [ ] Exportação de relatórios em PDF/Excel
- [ ] Notificações por e-mail para revisões próximas
