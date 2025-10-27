const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Configuração
const CONFIG_FILE = 'config.json';
const LOGS_FILE = 'logs.txt';

// Carregar configuração de arquivo JSON
function carregarConfiguracao() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      config.janelaMinutos = calcularJanelaMinutos(config.horarioInicio, config.horarioLimite);
      return config;
    }
  } catch (error) {
    log('Erro ao carregar configuração: ' + error.message, 'error');
  }
  
  // Valores padrão
  return {
    horarioInicio: '19:50',
    horarioLimite: '22:30',
    percentualMaximo: 40,
    janelaMinutos: 160
  };
}

// Salvar configuração em arquivo JSON
function salvarConfiguracao(config) {
  try {
    const { horarioInicio, horarioLimite, percentualMaximo } = config;
    const configParaSalvar = { horarioInicio, horarioLimite, percentualMaximo };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configParaSalvar, null, 2));
  } catch (error) {
    log('Erro ao salvar configuração: ' + error.message, 'error');
  }
}

let configuracao = carregarConfiguracao();

// Função de log (silencioso - apenas salva em arquivo)
function log(mensagem, tipo = 'info') {
  const timestamp = new Date().toISOString();
  const tipoStr = tipo.toUpperCase().padEnd(5);
  const logMessage = `[${timestamp}] [${tipoStr}] ${mensagem}\n`;
  
  // Salvar em arquivo (sem exibir no console)
  try {
    fs.appendFileSync(LOGS_FILE, logMessage);
  } catch (err) {
    console.error('Erro ao escrever log:', err);
  }
}

// Sanitização de string
function sanitizarString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/[<>'"`]/g, '');
}

// Validar formato de data/hora
function validarDataHora(dataHora) {
  if (!dataHora || typeof dataHora !== 'string') return false;
  
  const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if (!regex.test(dataHora)) return false;
  
  const date = new Date(dataHora);
  return !isNaN(date.getTime());
}

// Validar nota
function validarNota(nota) {
  if (!nota) return false;
  const notaNum = parseFloat(nota);
  return !isNaN(notaNum) && notaNum >= 0 && notaNum <= 100;
}

// Validar CSV
function validarEstruturaCSV(headers) {
  const requiredHeaders = ['nome', 'nota', 'datahora'];
  const headerLower = headers.map(h => h.trim().toLowerCase());
  
  for (const required of requiredHeaders) {
    if (!headerLower.includes(required)) {
      return { valid: false, error: `Coluna obrigatória ausente: ${required}` };
    }
  }
  
  return { valid: true };
}

// Configurar multer para upload de arquivos
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.csv') {
        cb(new Error('Apenas arquivos CSV são permitidos'), false);
        return;
      }
      cb(null, true);
    }
});

// Middleware de tratamento de erros
function tratarErro(erro, res, mensagem) {
  log(`${mensagem}: ${erro.message}`, 'error');
  return res.status(500).json({ 
    error: mensagem,
    details: erro.message 
  });
}

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

// Função para calcular a nota final com penalidades
function calcularNotaFinal(nota, dataHora) {
  const notaOriginal = parseFloat(nota);
  
  if (!validarDataHora(dataHora)) {
    log(`Data/hora inválida: ${dataHora}`, 'warn');
    return {
      notaFinal: 0,
      notaOriginal: notaOriginal,
      percentualDesconto: 0,
      valorDesconto: 0,
      minutosAtraso: 0,
      status: 'Data inválida'
    };
  }
  
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
    percentualDesconto: Math.round(percentualPenalidade * 10000) / 100,
    valorDesconto: Math.round(valorDesconto * 100) / 100,
    minutosAtraso: minutosAtrasoLimitados,
    status: minutosAtraso > configuracao.janelaMinutos ? 'Atraso máximo' : 'Com atraso'
  };
}

// Rota principal - página de upload
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    tratarErro(error, res, 'Erro ao carregar página inicial');
  }
});

// Rota para processar upload do CSV
app.post('/upload', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
  }
  
  const resultados = [];
  let linhaCount = 0;
  let linhasInvalidas = 0;
  let headersCapturados = false;
  let headers = [];
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('headers', (headerList) => {
      headers = headerList;
      headersCapturados = true;
      const validacao = validarEstruturaCSV(headers);
      if (!validacao.valid) {
        log(validacao.error, 'error');
        linhasInvalidas++;
      }
    })
    .on('data', (row) => {
      linhaCount++;
      
      // Sanitizar dados
      const nome = sanitizarString(row.nome);
      const notaStr = sanitizarString(row.nota);
      const dataHora = sanitizarString(row.datahora);
      
      // Validar dados
      if (!nome) {
        linhasInvalidas++;
        return;
      }
      
      if (!validarNota(notaStr)) {
        linhasInvalidas++;
        return;
      }
      
      if (!validarDataHora(dataHora)) {
        linhasInvalidas++;
        return;
      }
      
      const calculo = calcularNotaFinal(notaStr, dataHora);
      
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
    })
    .on('end', () => {
      log(`Processamento concluído. ${resultados.length} alunos processados. ${linhasInvalidas} linhas inválidas.`);
      
      // Limpar arquivo temporário
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        log(`Erro ao remover arquivo temporário: ${error.message}`, 'warn');
      }
      
      if (resultados.length === 0) {
        return res.status(400).json({ error: 'Nenhum aluno válido encontrado no arquivo' });
      }
      
      // Enviar resultados
      res.json({ 
        resultados: resultados,
        informacoes: {
          totalLinhas: linhaCount,
          linhasValidas: resultados.length,
          linhasInvalidas: linhasInvalidas
        }
      });
    })
    .on('error', (error) => {
      log(`Erro ao processar CSV: ${error.message}`, 'error');
      tratarErro(error, res, 'Erro ao processar o arquivo CSV');
    });
});

// Rota para página de resultados
app.get('/resultados', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'resultados.html'));
  } catch (error) {
    tratarErro(error, res, 'Erro ao carregar página de resultados');
  }
});

// Rota para página de configurações
app.get('/configuracoes', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'configuracoes.html'));
  } catch (error) {
    tratarErro(error, res, 'Erro ao carregar página de configurações');
  }
});

// Rota para página de estatísticas
app.get('/estatisticas', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'estatisticas.html'));
  } catch (error) {
    tratarErro(error, res, 'Erro ao carregar página de estatísticas');
  }
});

// Rota para obter configurações atuais
app.get('/api/configuracao', (req, res) => {
  try {
    res.json(configuracao);
  } catch (error) {
    tratarErro(error, res, 'Erro ao obter configuração');
  }
});

// Rota para atualizar configurações
app.post('/api/configuracao', (req, res) => {
  try {
    const { horarioInicio, horarioLimite, percentualMaximo } = req.body;
    
  // Validar dados
  if (!horarioInicio || !horarioLimite || percentualMaximo === undefined) {
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
    return res.status(400).json({ error: 'Percentual deve ser um número entre 0 e 100 (excluindo os extremos)' });
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
    
    // Salvar em arquivo
    salvarConfiguracao(configuracao);
    
    res.json({ 
      success: true, 
      message: 'Configuração atualizada com sucesso',
      configuracao: configuracao 
    });
  } catch (error) {
    tratarErro(error, res, 'Erro ao atualizar configuração');
  }
});

// Middleware de erro global
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      log('Arquivo muito grande enviado', 'warn');
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 5MB' });
    }
  }
  
  log(`Erro não tratado: ${err.message}`, 'error');
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
