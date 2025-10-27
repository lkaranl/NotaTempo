const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Parâmetros de configuração (valores padrão)
let configuracao = {
  horarioInicio: '19:50',        // Horário que começa a penalidade
  horarioLimite: '22:30',        // Horário limite final
  percentualMaximo: 40,          // Percentual máximo de desconto
  janelaMinutos: 160             // Janela de tempo em minutos (calculada automaticamente)
};

// Configurar multer para upload de arquivos
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname) === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
  }
});

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Função para calcular a janela de tempo em minutos
function calcularJanelaMinutos(horarioInicio, horarioLimite) {
  const [horaInicio, minutoInicio] = horarioInicio.split(':').map(Number);
  const [horaLimite, minutoLimite] = horarioLimite.split(':').map(Number);
  
  const inicioMinutos = horaInicio * 60 + minutoInicio;
  const limiteMinutos = horaLimite * 60 + minutoLimite;
  
  return limiteMinutos - inicioMinutos;
}

// Função para calcular a nota final com penalidades e informações detalhadas
function calcularNotaFinal(nota, dataHora) {
  const notaOriginal = parseFloat(nota);
  const dataEntrega = new Date(dataHora);
  
  // Usar configurações atuais
  const [horaInicio, minutoInicio] = configuracao.horarioInicio.split(':').map(Number);
  const [horaLimite, minutoLimite] = configuracao.horarioLimite.split(':').map(Number);
  
  // Horário limite sem penalidade
  const horarioLimite = new Date(dataEntrega);
  horarioLimite.setHours(horaInicio, minutoInicio, 0, 0);
  
  // Horário de corte com penalidade máxima
  const horarioCorte = new Date(dataEntrega);
  horarioCorte.setHours(horaLimite, minutoLimite, 0, 0);
  
  // Se entregou antes ou no horário limite, sem penalidade
  if (dataEntrega <= horarioLimite) {
    return {
      notaFinal: Math.round(notaOriginal),
      notaOriginal: notaOriginal,
      percentualDesconto: 0,
      valorDesconto: 0,
      minutosAtraso: 0,
      status: 'No prazo'
    };
  }
  
  // Se a nota é 0 (não entregou a prova), não aplicar penalidade
  if (notaOriginal <= 0.5) {
    return {
      notaFinal: Math.round(notaOriginal),
      notaOriginal: notaOriginal,
      percentualDesconto: 0,
      valorDesconto: 0,
      minutosAtraso: 0,
      status: 'Não entregou'
    };
  }
  
  // Se a nota é 10 (nota mínima para não zerar), não aplicar penalidade
  if (notaOriginal >= 9.5 && notaOriginal <= 10.5) {
    return {
      notaFinal: Math.round(notaOriginal),
      notaOriginal: notaOriginal,
      percentualDesconto: 0,
      valorDesconto: 0,
      minutosAtraso: 0,
      status: 'Nota mínima'
    };
  }
  
  // Calcular minutos de atraso
  const minutosAtraso = Math.floor((dataEntrega - horarioLimite) / (1000 * 60));
  
  // Limitar atraso máximo à janela configurada
  const minutosAtrasoLimitados = Math.min(minutosAtraso, configuracao.janelaMinutos);
  
  // Calcular percentual de penalidade
  const percentualPenalidade = minutosAtrasoLimitados * (configuracao.percentualMaximo / 100 / configuracao.janelaMinutos);
  
  // Calcular valores
  const valorDesconto = notaOriginal * percentualPenalidade;
  const notaFinal = notaOriginal - valorDesconto;
  
  return {
    notaFinal: Math.round(notaFinal),
    notaOriginal: notaOriginal,
    percentualDesconto: Math.round(percentualPenalidade * 10000) / 100, // Em %
    valorDesconto: Math.round(valorDesconto * 100) / 100,
    minutosAtraso: minutosAtrasoLimitados,
    status: minutosAtraso > configuracao.janelaMinutos ? 'Atraso máximo' : 'Com atraso'
  };
}

// Rota principal - página de upload
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para processar upload do CSV
app.post('/upload', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
  }

  console.log('Arquivo recebido:', req.file.originalname);
  const resultados = [];
  let linhaCount = 0;
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      linhaCount++;
      console.log(`Linha ${linhaCount}:`, row);
      
      const nome = row.nome;
      const nota = row.nota;
      const dataHora = row.datahora;
      
      if (nome && nota && dataHora) {
        const calculo = calcularNotaFinal(nota, dataHora);
        console.log(`${nome}: ${nota} -> ${calculo.notaFinal} (${calculo.percentualDesconto}% desconto, ${calculo.minutosAtraso}min atraso)`);
        resultados.push({
          nome: nome,
          notaFinal: calculo.notaFinal,
          notaOriginal: calculo.notaOriginal,
          percentualDesconto: calculo.percentualDesconto,
          valorDesconto: calculo.valorDesconto,
          minutosAtraso: calculo.minutosAtraso,
          status: calculo.status,
          dataHora: dataHora
        });
      } else {
        console.log('Linha ignorada - dados incompletos:', row);
      }
    })
    .on('end', () => {
      console.log(`Processamento concluído. ${resultados.length} alunos processados.`);
      
      // Limpar arquivo temporário
      fs.unlinkSync(req.file.path);
      
      // Enviar resultados para a página de resultados
      res.json({ resultados: resultados });
    })
    .on('error', (error) => {
      console.error('Erro ao processar CSV:', error);
      res.status(500).json({ error: 'Erro ao processar o arquivo CSV: ' + error.message });
    });
});

// Rota para página de resultados
app.get('/resultados', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'resultados.html'));
});

// Rota para página de configurações
app.get('/configuracoes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configuracoes.html'));
});

// Rota para página de estatísticas
app.get('/estatisticas', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'estatisticas.html'));
});

// Rota para obter configurações atuais
app.get('/api/configuracao', (req, res) => {
  res.json(configuracao);
});

// Rota para atualizar configurações
app.post('/api/configuracao', (req, res) => {
  const { horarioInicio, horarioLimite, percentualMaximo } = req.body;
  
  // Validar dados
  if (!horarioInicio || !horarioLimite || !percentualMaximo) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  // Validar formato de horário (HH:MM)
  const horarioRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!horarioRegex.test(horarioInicio) || !horarioRegex.test(horarioLimite)) {
    return res.status(400).json({ error: 'Formato de horário inválido. Use HH:MM' });
  }
  
  // Validar percentual
  const percentual = parseFloat(percentualMaximo);
  if (isNaN(percentual) || percentual <= 0 || percentual >= 100) {
    return res.status(400).json({ error: 'Percentual deve ser um número entre 0% e 100% (excluindo os extremos)' });
  }
  
  // Validar se horário limite é maior que horário início
  const [horaInicio, minutoInicio] = horarioInicio.split(':').map(Number);
  const [horaLimite, minutoLimite] = horarioLimite.split(':').map(Number);
  const inicioMinutos = horaInicio * 60 + minutoInicio;
  const limiteMinutos = horaLimite * 60 + minutoLimite;
  
  if (limiteMinutos <= inicioMinutos) {
    return res.status(400).json({ error: 'Horário limite deve ser maior que horário de início' });
  }
  
  // Atualizar configuração
  configuracao.horarioInicio = horarioInicio;
  configuracao.horarioLimite = horarioLimite;
  configuracao.percentualMaximo = percentual;
  configuracao.janelaMinutos = calcularJanelaMinutos(horarioInicio, horarioLimite);
  
  console.log('Configuração atualizada:', configuracao);
  
  res.json({ 
    success: true, 
    message: 'Configuração atualizada com sucesso',
    configuracao: configuracao 
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
