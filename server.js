const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

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

// Função para calcular a nota final com penalidades e informações detalhadas
function calcularNotaFinal(nota, dataHora) {
  const notaOriginal = parseFloat(nota);
  const dataEntrega = new Date(dataHora);
  
  // Horário limite sem penalidade: 19:50:00
  const horarioLimite = new Date(dataEntrega);
  horarioLimite.setHours(19, 50, 0, 0);
  
  // Horário de corte com penalidade máxima: 22:30:00
  const horarioCorte = new Date(dataEntrega);
  horarioCorte.setHours(22, 30, 0, 0);
  
  // Se entregou antes ou no horário limite, sem penalidade
  if (dataEntrega <= horarioLimite) {
    return {
      notaFinal: notaOriginal,
      notaOriginal: notaOriginal,
      percentualDesconto: 0,
      valorDesconto: 0,
      minutosAtraso: 0,
      status: 'No prazo'
    };
  }
  
  // Calcular minutos de atraso
  const minutosAtraso = Math.floor((dataEntrega - horarioLimite) / (1000 * 60));
  
  // Limitar atraso máximo a 160 minutos (até 22:30)
  const minutosAtrasoLimitados = Math.min(minutosAtraso, 160);
  
  // Calcular percentual de penalidade
  const percentualPenalidade = minutosAtrasoLimitados * (0.40 / 160);
  
  // Calcular valores
  const valorDesconto = notaOriginal * percentualPenalidade;
  const notaFinal = notaOriginal - valorDesconto;
  
  return {
    notaFinal: Math.round(notaFinal * 100) / 100,
    notaOriginal: notaOriginal,
    percentualDesconto: Math.round(percentualPenalidade * 10000) / 100, // Em %
    valorDesconto: Math.round(valorDesconto * 100) / 100,
    minutosAtraso: minutosAtrasoLimitados,
    status: minutosAtraso > 160 ? 'Atraso máximo' : 'Com atraso'
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

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
