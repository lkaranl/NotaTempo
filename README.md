# NotaTempo 📚

Sistema web para processamento de notas de alunos com penalidades por atraso na entrega.

## 🚀 Funcionalidades

- **Upload de CSV**: Interface simples para upload de arquivos CSV
- **Cálculo Automático**: Aplica penalidades baseadas no horário de entrega
- **Visualização de Resultados**: Tabela organizada com as notas finais
- **Interface Responsiva**: Design moderno e adaptável

## 📋 Regras de Penalidade

- **Horário Limite**: 19:50:00 (sem penalidade)
- **Horário de Corte**: 22:30:00 (penalidade máxima)
- **Penalidade Máxima**: 40% da nota original
- **Cálculo**: Penalidade linear distribuída em 160 minutos

## 🛠️ Instalação

1. Instale as dependências:
```bash
npm install
```

2. Execute o servidor:
```bash
npm start
```

3. Acesse: http://localhost:3000

## 📁 Formato do CSV

O arquivo deve conter as colunas:
- `nome`: Nome do aluno
- `nota`: Nota original (ex: 10.0)
- `datahora`: Timestamp da entrega (ex: "2025-01-15 20:30:00")

## 📊 Exemplos de Cálculo

Para uma nota original de 10.0:

- **19:45**: Nota Final = 10.0 (sem penalidade)
- **20:30**: Nota Final = 9.0 (10% de penalidade)
- **22:30**: Nota Final = 6.0 (40% de penalidade)
- **23:00**: Nota Final = 6.0 (penalidade máxima)

## 🎨 Tecnologias

- **Backend**: Node.js + Express
- **Frontend**: HTML5 + CSS3 + JavaScript
- **Processamento**: Multer + CSV Parser
- **Estilo**: CSS Grid + Flexbox

## 📝 Uso

1. Faça upload do arquivo `alunos.csv`
2. Aguarde o processamento
3. Visualize os resultados na tabela
4. Use o arquivo `exemplo_alunos.csv` para testar