const { Readable } = require('stream');
const csv = require('csv-parser');

// Configuração em memória
let configuracao = {
  horarioInicio: '19:50',
  horarioLimite: '22:30',
  percentualMaximo: 40,
  janelaMinutos: 160
};

function calcularJanelaMinutos(horarioInicio, horarioLimite) {
  const [horaInicio, minutoInicio] = horarioInicio.split(':').map(Number);
  const [horaLimite, minutoLimite] = horarioLimite.split(':').map(Number);
  const inicioMinutos = horaInicio * 60 + minutoInicio;
  const limiteMinutos = horaLimite * 60 + minutoLimite;
  return limiteMinutos - inicioMinutos;
}

function sanitizarString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/[<>'"`]/g, '');
}

function validarDataHora(dataHora) {
  if (!dataHora || typeof dataHora !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if (!regex.test(dataHora)) return false;
  const date = new Date(dataHora);
  return !isNaN(date.getTime());
}

function validarNota(nota) {
  if (!nota) return false;
  const notaNum = parseFloat(nota);
  return !isNaN(notaNum) && notaNum >= 0 && notaNum <= 100;
}

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

function calcularNotaFinal(nota, dataHora) {
  const notaOriginal = parseFloat(nota);
  
  if (!validarDataHora(dataHora)) {
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
  const [horaInicio, minutoInicio] = configuracao.horarioInicio.split(':').map(Number);
  const [horaLimite, minutoLimite] = configuracao.horarioLimite.split(':').map(Number);
  
  const horarioLimite = new Date(dataEntrega);
  horarioLimite.setHours(horaInicio, minutoInicio, 0, 0);
  
  const horarioCorte = new Date(dataEntrega);
  horarioCorte.setHours(horaLimite, minutoLimite, 0, 0);
  
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
  
  const minutosAtraso = Math.floor((dataEntrega - horarioLimite) / (1000 * 60));
  const minutosAtrasoLimitados = Math.min(minutosAtraso, configuracao.janelaMinutos);
  const percentualPenalidade = minutosAtrasoLimitados * (configuracao.percentualMaximo / 100 / configuracao.janelaMinutos);
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

function processarCSV(buffer) {
  return new Promise((resolve, reject) => {
    const resultados = [];
    let linhaCount = 0;
    let linhasInvalidas = 0;
    let headers = [];
    
    const bufferStream = Readable.from(buffer.toString('utf8'));
    
    bufferStream
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        const validacao = validarEstruturaCSV(headers);
        if (!validacao.valid) {
          linhasInvalidas++;
        }
      })
      .on('data', (row) => {
        linhaCount++;
        const nome = sanitizarString(row.nome);
        const notaStr = sanitizarString(row.nota);
        const dataHora = sanitizarString(row.datahora);
        
        if (!nome || !validarNota(notaStr) || !validarDataHora(dataHora)) {
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
        resolve({
          resultados,
          informacoes: {
            totalLinhas: linhaCount,
            linhasValidas: resultados.length,
            linhasInvalidas: linhasInvalidas
          }
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Rota GET /api/configuracao
  if (req.method === 'GET' && req.url === '/api/configuracao') {
    return res.json(configuracao);
  }
  
  // Rota POST /api/configuracao
  if (req.method === 'POST' && req.url === '/api/configuracao') {
    const { horarioInicio, horarioLimite, percentualMaximo } = req.body;
    
    if (!horarioInicio || !horarioLimite || percentualMaximo === undefined) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    
    const horarioRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horarioRegex.test(horarioInicio) || !horarioRegex.test(horarioLimite)) {
      return res.status(400).json({ error: 'Formato de horário inválido. Use HH:MM' });
    }
    
    const percentual = parseFloat(percentualMaximo);
    if (isNaN(percentual) || percentual <= 0 || percentual >= 100) {
      return res.status(400).json({ error: 'Percentual deve ser um número entre 0 e 100' });
    }
    
    const [horaInicio, minutoInicio] = horarioInicio.split(':').map(Number);
    const [horaLimite, minutoLimite] = horarioLimite.split(':').map(Number);
    const inicioMinutos = horaInicio * 60 + minutoInicio;
    const limiteMinutos = horaLimite * 60 + minutoLimite;
    
    if (limiteMinutos <= inicioMinutos) {
      return res.status(400).json({ error: 'Horário limite deve ser maior que horário de início' });
    }
    
    configuracao.horarioInicio = horarioInicio;
    configuracao.horarioLimite = horarioLimite;
    configuracao.percentualMaximo = percentual;
    configuracao.janelaMinutos = calcularJanelaMinutos(horarioInicio, horarioLimite);
    
    return res.json({ 
      success: true, 
      message: 'Configuração atualizada com sucesso',
      configuracao: configuracao 
    });
  }
  
  // Rota POST /api/upload
  if (req.method === 'POST' && req.url === '/api/upload') {
    try {
      const multer = require('multer');
      const uploadMemory = multer({ 
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ext = require('path').extname(file.originalname).toLowerCase();
          if (ext !== '.csv') {
            cb(new Error('Apenas arquivos CSV são permitidos'), false);
            return;
          }
          cb(null, true);
        }
      });
      
      uploadMemory.single('csvFile')(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
        }
        
        try {
          const resultado = await processarCSV(req.file.buffer);
          
          if (resultado.resultados.length === 0) {
            return res.status(400).json({ error: 'Nenhum aluno válido encontrado no arquivo' });
          }
          
          res.json(resultado);
        } catch (error) {
          res.status(500).json({ error: 'Erro ao processar CSV', details: error.message });
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro no servidor', details: error.message });
    }
  } else {
    res.status(404).json({ error: 'Rota não encontrada' });
  }
};
