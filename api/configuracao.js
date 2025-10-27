let configuracao = {
  horarioInicio: '19:50',
  horarioLimite: '22:30',
  percentualMaximo: 40,
  janelaMinutos: 160
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.json(configuracao);
  }
  
  if (req.method === 'POST') {
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
    
    const janelaMinutos = limiteMinutos - inicioMinutos;
    
    configuracao.horarioInicio = horarioInicio;
    configuracao.horarioLimite = horarioLimite;
    configuracao.percentualMaximo = percentual;
    configuracao.janelaMinutos = janelaMinutos;
    
    return res.json({ 
      success: true, 
      message: 'Configuração atualizada com sucesso',
      configuracao: configuracao 
    });
  }
  
  return res.status(405).json({ error: 'Método não permitido' });
};

