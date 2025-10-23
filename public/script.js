document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('csvFile');
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.querySelector('.upload-btn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');

    // Carregar configurações atuais
    carregarConfiguracaoAtual();

    // Atualizar configurações quando a página voltar ao foco
    window.addEventListener('focus', carregarConfiguracaoAtual);

    // Habilitar/desabilitar botão baseado na seleção de arquivo
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            uploadBtn.disabled = false;
            hideError();
            
            // Mostrar nome do arquivo selecionado
            const fileName = this.files[0].name;
            const fileText = document.querySelector('.file-input-text');
            fileText.textContent = `Arquivo selecionado: ${fileName}`;
        } else {
            uploadBtn.disabled = true;
            const fileText = document.querySelector('.file-input-text');
            fileText.textContent = 'Escolher arquivo CSV';
        }
    });

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

        fetch('/upload', {
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
            // Salvar resultados no localStorage
            localStorage.setItem('resultadosNotas', JSON.stringify(data.resultados));
            
            // Redirecionar para página de resultados
            window.location.href = '/resultados';
        })
        .catch(error => {
            console.error('Erro:', error);
            showError(error.error || 'Erro ao processar o arquivo. Tente novamente.');
            hideLoading();
        });
    }

    function showLoading() {
        loading.classList.remove('hidden');
        uploadBtn.disabled = true;
        uploadBtn.querySelector('.btn-text').textContent = 'Processando...';
    }

    function hideLoading() {
        loading.classList.add('hidden');
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn-text').textContent = 'Processar Notas';
    }

    function showError(message) {
        errorMessage.textContent = message;
        error.classList.remove('hidden');
    }

    function hideError() {
        error.classList.add('hidden');
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
    }

    function unhighlight(e) {
        fileInputLabel.style.borderColor = '#cbd5e0';
        fileInputLabel.style.backgroundColor = '#f7fafc';
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
