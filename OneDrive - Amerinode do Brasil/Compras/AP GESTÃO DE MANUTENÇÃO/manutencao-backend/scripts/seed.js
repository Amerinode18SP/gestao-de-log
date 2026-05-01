require('dotenv').config()
const supabase = require('../src/supabase')

async function seed() {
  console.log('🌱  Inserindo dados de exemplo...')

  // Veículos
  const { data: veiculos } = await supabase.from('veiculos').insert([
    { placa: 'BRA-2025', localidade: 'São Paulo', km_atual: 29800, proxima_revisao: '2025-07-15' },
    { placa: 'DEF-4321', localidade: 'Campinas',  km_atual: 55000, proxima_revisao: '2025-06-20' },
    { placa: 'GHI-9876', localidade: 'Santos',    km_atual: 72000, proxima_revisao: '2025-08-01' },
    { placa: 'JKL-5555', localidade: 'Ribeirão Preto', km_atual: 38000, proxima_revisao: '2025-05-03' },
  ]).select()

  // Fornecedores
  const { data: fornecedores } = await supabase.from('fornecedores').insert([
    { razao_social: 'Auto Center Rápido Ltda',    cnpj: '12345678000190' },
    { razao_social: 'Pneucentro Distribuidora',   cnpj: '98765432000111' },
    { razao_social: 'Freios & Cia',               cnpj: '11222333000144' },
    { razao_social: 'AlignCar Centro Automotivo', cnpj: '55444333000122' },
  ]).select()

  // Ordens
  await supabase.from('ordens').insert([
    { veiculo_id: veiculos[0].id, fornecedor_id: fornecedores[0].id, supervisor: 'Carlos Mendes',
      num_ordem: 'OC-44821', link_ordem: 'https://app.cotabox.com.br/orders/44821',
      nota_fiscal: '7801', data_ordem: '2025-04-10', categoria: 'Serviço',
      item: 'Revisão 30.000 km', valor_item: 850, quantidade: 1, valor_total: 850,
      status: 'Em Preparação', origem: 'Cotabox' },
    { veiculo_id: veiculos[1].id, fornecedor_id: fornecedores[1].id, supervisor: 'Ana Souza',
      num_ordem: 'OC-44822', link_ordem: 'https://app.cotabox.com.br/orders/44822',
      nota_fiscal: '7802', data_ordem: '2025-04-12', categoria: 'Produto',
      item: 'Pneus Michelin 195/65 R15', valor_item: 420, quantidade: 4, valor_total: 1680,
      status: 'Em Preparação', origem: 'Cotabox' },
    { veiculo_id: veiculos[2].id, fornecedor_id: fornecedores[2].id, supervisor: 'Roberto Lima',
      nota_fiscal: '7803', data_ordem: '2025-03-20', categoria: 'Serviço',
      item: 'Troca de pastilhas de freio', valor_item: 320, quantidade: 1, valor_total: 320,
      status: 'Concluído', origem: 'Manual' },
    { veiculo_id: veiculos[3].id, fornecedor_id: fornecedores[3].id, supervisor: 'Fernanda Costa',
      num_ordem: 'OC-44824', link_ordem: 'https://app.cotabox.com.br/orders/44824',
      nota_fiscal: '7804', data_ordem: '2025-04-20', categoria: 'Serviço',
      item: 'Alinhamento e balanceamento', valor_item: 280, quantidade: 1, valor_total: 280,
      status: 'Pendente', origem: 'Manual' },
  ])

  console.log('✅  Seed concluído!')
  process.exit(0)
}

seed().catch(err => { console.error('❌ Erro no seed:', err); process.exit(1) })
