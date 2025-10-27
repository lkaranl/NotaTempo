document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('csvFile');
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.querySelector('.upload-btn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    const csvPreview = document.getElementById('csvPreview');
    const uploadProgress = document.getElementById('uploadProgress');

    // Carregar configurações atuais
    carregarConfiguracaoAtual();

    // Atualizar configurações quando a página voltar ao foco
    window.addEventListener('focus', carregarConfiguracaoAtual);

    // Habilitar/desabilitar botão baseado na seleção de arquivo
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            uploadBtn.disabled = false;
            hideError();
            hidePreview();
            
            const file = this.files[0];
            const fileName = file.name;
            const fileText = document.querySelector('.file-input-text');
            fileText.textContent = `Arquivo selecionado: ${fileName}`;
            
            // Validar e fazer preview do CSV
            validarEpreviewCSV(file);
        } else {
            uploadBtn.disabled = true;
            const fileText = document.querySelector('.file-input-text');
            fileText.textContent = 'Escolher arquivo CSV';
            hidePreview();
        }
    });

    function validarEpreviewCSV(file) {
        // Validar tamanho do arquivo (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showError('Arquivo muito grande. Tamanho máximo: 5MB');
            uploadBtn.disabled = true;
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                showError('Arquivo CSV deve ter pelo menos 2 linhas (cabeçalho + dados)');
                uploadBtn.disabled = true;
                return;
            }

            const headers = lines[0].split(',');
            const requiredHeaders = ['nome', 'nota', 'datahora'];
            
            // Validar cabeçalho
            const headerLower = headers.map(h => h.trim().toLowerCase());
            const hasRequiredHeaders = requiredHeaders.every(header => 
                headerLower.includes(header)
            );

            if (!hasRequiredHeaders) {
                showError('CSV deve conter as colunas: nome, nota, datahora');
                uploadBtn.disabled = true;
                return;
            }

            // Exibir preview
            const lineCount = lines.length - 1; // Menos o cabeçalho
            const fileSizeKB = (file.size / 1024).toFixed(2);
            
            document.getElementById('previewFileName').textContent = file.name;
            document.getElementById('previewFileSize').textContent = `${fileSizeKB} KB`;
            document.getElementById('previewLineCount').textContent = lineCount + ' alunos';

            // Criar tabela de preview
            const previewHead = document.getElementById('previewTableHead');
            const previewBody = document.getElementById('previewTableBody');
            
            previewHead.innerHTML = '';
            previewBody.innerHTML = '';

            const thead = document.createElement('tr');
            headers.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header.trim();
                thead.appendChild(th);
            });
            previewHead.appendChild(thead);

            // Mostrar apenas 5 primeiras linhas
            const previewLines = lines.slice(1, 6);
            previewLines.forEach(line => {
                const tr = document.createElement('tr');
                const cols = line.split(',');
                cols.forEach(col => {
                    const td = document.createElement('td');
                    td.textContent = col.trim();
                    tr.appendChild(td);
                });
                previewBody.appendChild(tr);
            });

            if (lineCount > 5) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = headers.length;
                td.textContent = `... e mais ${lineCount - 5} linhas`;
                td.style.textAlign = 'center';
                td.style.fontStyle = 'italic';
                td.style.color = '#718096';
                tr.appendChild(td);
                previewBody.appendChild(tr);
            }

            csvPreview.classList.remove('hidden');
            csvPreview.style.animation = 'fadeInUp 0.5s ease-out';
        };

        reader.onerror = function() {
            showError('Erro ao ler o arquivo');
            uploadBtn.disabled = true;
        };

        reader.readAsText(file);
    }

    // Manipular envio do formulário
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!fileInput.files[0]) {
            showError('Por favor, selecione um arquivo CSV');
            return;
        }

        // Validar tipo de arquivo
        const file = fileInput.files[0];
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showError('Por favor, selecione um arquivo CSV válido');
            return;
        }

        uploadFile(file);
    });

    function uploadFile(file) {
        showLoading();
        hideError();

        const formData = new FormData();
        formData.append('csvFile', file);

        // Simular progresso
        simularProgresso();

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // Completar progresso
            atualizarProgresso(100, 'Finalizando...');
            
            setTimeout(() => {
                // Salvar resultados no localStorage
                localStorage.setItem('resultadosNotas', JSON.stringify(data.resultados));
                
                // Redirecionar para página de resultados com animação
                window.location.href = '/resultados';
            }, 500);
        })
        .catch(error => {
            console.error('Erro:', error);
            showError(error.error || 'Erro ao processar o arquivo. Tente novamente.');
            hideLoading();
            hideProgress();
        });
    }

    function simularProgresso() {
        const steps = [
            { progress: 10, status: 'Carregando arquivo...', step: 1 },
            { progress: 30, status: 'Analisando dados...', step: 2 },
            { progress: 60, status: 'Calculando penalidades...', step: 3 },
            { progress: 90, status: 'Processando resultados...', step: 4 },
        ];

        let currentStep = 0;
        updateSteps(1);

        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                atualizarProgresso(step.progress, step.status);
                updateSteps(step.step);
                currentStep++;
            } else {
                clearInterval(interval);
            }
        }, 300);
    }

    function atualizarProgresso(percentage, status) {
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressPercentage').textContent = percentage + '%';
        document.getElementById('progressStatus').textContent = status;
        uploadProgress.classList.remove('hidden');
    }

    function updateSteps(activeStep) {
        for (let i = 1; i <= 4; i++) {
            const step = document.getElementById(`step${i}`);
            if (i <= activeStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        }
    }

    function showLoading() {
        loading.classList.remove('hidden');
        uploadBtn.disabled = true;
        uploadBtn.querySelector('.btn-text').textContent = 'Processando...';
        hidePreview();
        uploadProgress.classList.remove('hidden');
    }

    function hideLoading() {
        loading.classList.add('hidden');
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn-text').textContent = 'Processar Notas';
        hideProgress();
    }

    function hideProgress() {
        uploadProgress.classList.add('hidden');
    }

    function showError(message) {
        errorMessage.textContent = message;
        error.classList.remove('hidden');
        error.style.animation = 'shake 0.5s ease-in-out';
    }

    function hideError() {
        error.classList.add('hidden');
    }

    function hidePreview() {
        csvPreview.classList.add('hidden');
    }

    // Drag and drop para o input de arquivo
    const fileInputLabel = document.querySelector('.file-input-label');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        fileInputLabel.style.borderColor = '#667eea';
        fileInputLabel.style.backgroundColor = '#edf2f7';
        fileInputLabel.style.transform = 'scale(1.02)';
        fileInputLabel.style.transition = 'all 0.3s ease';
    }

    function unhighlight(e) {
        fileInputLabel.style.borderColor = '#cbd5e0';
        fileInputLabel.style.backgroundColor = '#f7fafc';
        fileInputLabel.style.transform = 'scale(1)';
    }

    fileInputLabel.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change'));
        }
    }

    // Função para carregar configuração atual
    function carregarConfiguracaoAtual() {
        fetch('/api/configuracao')
            .then(response => response.json())
            .then(data => {
                atualizarRegrasPenalidade(data);
            })
            .catch(error => {
                console.error('Erro ao carregar configuração:', error);
                // Manter valores padrão se houver erro
            });
    }

    // Função para atualizar as regras de penalidade na interface
    function atualizarRegrasPenalidade(config) {
        document.getElementById('horarioLimite').textContent = config.horarioInicio + ':00';
        document.getElementById('horarioCorte').textContent = config.horarioLimite + ':00';
        document.getElementById('penalidadeMaxima').textContent = config.percentualMaximo + '%';
        document.getElementById('janelaMinutos').textContent = config.janelaMinutos;
    }
});
