# Como Fazer Deploy do NotaTempo

## 🚀 Opção 1: Vercel (Recomendado - Grátis)

### Passo a Passo:

1. **Instale a CLI da Vercel:**
```bash
npm install -g vercel
```

2. **Faça login:**
```bash
vercel login
```

3. **Na pasta do projeto, execute:**
```bash
vercel
```

4. Siga as instruções na tela
5. O site estará no ar automaticamente!

### Ou pelo site:
1. Acesse https://vercel.com
2. Conecte seu repositório GitHub
3. Deixe a Vercel fazer o deploy automaticamente

---

## 🌐 Opção 2: Render (Alternativa Grátis)

### No site da Render:
1. Acesse https://render.com
2. Crie uma conta gratuita
3. Conecte seu repositório
4. Escolha "Web Service"
5. Configure:
   - **Start Command:** `node server.js`
   - **Environment:** Node
6. Deploy automático!

---

## 📦 Opção 3: Heroku (Legado)

### Passo a Passo:

1. **Instale a Heroku CLI**
2. **Crie um arquivo `Procfile`:**
```
web: node server.js
```

3. **Execute:**
```bash
heroku create
git push heroku main
```

---

## ⚠️ O que NÃO funciona:

- ❌ **GitHub Pages** - Não suporta Node.js
- ❌ **Netlify (sem configuração especial)** - Precisa de serverless functions
- ❌ **Fazer upload manual** - Precisa de servidor rodando

---

## ✅ Melhor Opção: Vercel

Vercel é a melhor opção para este projeto porque:
- ✅ Grátis para projetos pessoais
- ✅ Deploy automático do GitHub
- ✅ SSL automático
- ✅ Suporta Node.js nativamente
- ✅ Setup em minutos

