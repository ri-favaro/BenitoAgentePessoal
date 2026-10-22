/**
 * Benito Calculadora - Lógica do Cliente JavaScript
 *
 * Gerencia o estado da calculadora, interações táteis/clique,
 * suporte completo a teclado físico e chamadas assíncronas à API Flask.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const mainDisplay = document.getElementById('mainDisplay');
  const subDisplay = document.getElementById('subDisplay');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const apiStatusBadge = document.getElementById('apiStatusBadge');
  const apiStatusText = document.getElementById('apiStatusText');
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');

  // Estado da Calculadora
  let currentInput = '0';
  let previousOperand = null;
  let currentOperation = null; // 'add' | 'subtract' | 'multiply' | 'divide'
  let currentSymbol = null;    // '+' | '-' | '×' | '÷'
  let shouldResetDisplay = false;
  let isApiOnline = false;

  // ==========================================
  // Utilitários de Interface & Display
  // ==========================================
  function updateDisplay(isError = false) {
    if (isError) {
      mainDisplay.classList.add('error');
    } else {
      mainDisplay.classList.remove('error');
    }

    // Ajusta o tamanho da fonte se o número for muito longo
    if (currentInput.length > 12) {
      mainDisplay.style.fontSize = '1.6rem';
    } else if (currentInput.length > 8) {
      mainDisplay.style.fontSize = '2.0rem';
    } else {
      mainDisplay.style.fontSize = '2.4rem';
    }

    mainDisplay.textContent = currentInput;
  }

  function showToast(message, isError = true) {
    toastMessage.textContent = message;
    toastNotification.classList.add('show');
    setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 3500);
  }

  // ==========================================
  // Operações de Entrada
  // ==========================================
  function inputDigit(digit) {
    if (shouldResetDisplay) {
      currentInput = digit;
      shouldResetDisplay = false;
    } else {
      if (currentInput === '0' || currentInput === 'Erro') {
        currentInput = digit;
      } else {
        if (currentInput.length < 16) {
          currentInput += digit;
        }
      }
    }
    updateDisplay();
  }

  function inputDecimal() {
    if (shouldResetDisplay) {
      currentInput = '0.';
      shouldResetDisplay = false;
      updateDisplay();
      return;
    }

    if (!currentInput.includes('.')) {
      currentInput += '.';
      updateDisplay();
    }
  }

  function toggleSign() {
    if (currentInput === '0' || currentInput === 'Erro') return;

    if (currentInput.startsWith('-')) {
      currentInput = currentInput.slice(1);
    } else {
      currentInput = '-' + currentInput;
    }
    updateDisplay();
  }

  function deleteDigit() {
    if (shouldResetDisplay || currentInput === 'Erro') {
      allClear();
      return;
    }

    if (currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
      if (currentInput === '-' || currentInput === '') {
        currentInput = '0';
      }
    } else {
      currentInput = '0';
    }
    updateDisplay();
  }

  function allClear() {
    currentInput = '0';
    previousOperand = null;
    currentOperation = null;
    currentSymbol = null;
    shouldResetDisplay = false;
    subDisplay.textContent = '';
    clearActiveOpStyles();
    updateDisplay();
  }

  function clearActiveOpStyles() {
    document.querySelectorAll('.btn-op').forEach((btn) => {
      btn.classList.remove('active-op');
    });
  }

  // ==========================================
  // Seleção de Operador e Cálculo
  // ==========================================
  async function selectOperation(op, symbol, buttonEl) {
    if (currentInput === 'Erro') {
      allClear();
    }

    // Se já havia uma operação pendente e o usuário não recalculou ainda
    if (previousOperand !== null && currentOperation && !shouldResetDisplay) {
      await executeCalculation();
    }

    previousOperand = parseFloat(currentInput);
    currentOperation = op;
    currentSymbol = symbol;
    shouldResetDisplay = true;

    subDisplay.textContent = `${previousOperand} ${currentSymbol}`;
    clearActiveOpStyles();
    if (buttonEl) {
      buttonEl.classList.add('active-op');
    }
  }

  async function executeCalculation() {
    if (previousOperand === null || !currentOperation) {
      return;
    }

    const operandA = previousOperand;
    const operandB = parseFloat(currentInput);
    const operation = currentOperation;
    const symbol = currentSymbol;

    clearActiveOpStyles();

    try {
      if (isApiOnline) {
        // Chamada assíncrona ao backend Flask
        const response = await fetch('/api/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: operation,
            a: operandA,
            b: operandB,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          currentInput = String(data.result);
          subDisplay.textContent = data.expression;
          previousOperand = null;
          currentOperation = null;
          currentSymbol = null;
          shouldResetDisplay = true;
          updateDisplay();
          loadHistory();
        } else {
          // Erro (ex: divisão por zero)
          const errorMsg = data.error || 'Erro no cálculo.';
          showToast(errorMsg);
          currentInput = 'Erro';
          subDisplay.textContent = `${operandA} ${symbol} ${operandB} =`;
          previousOperand = null;
          currentOperation = null;
          currentSymbol = null;
          shouldResetDisplay = true;
          updateDisplay(true);
        }
      } else {
        // Fallback local se o backend não estiver respondendo
        executeLocalCalculation(operandA, operandB, operation, symbol);
      }
    } catch (err) {
      // Falha de rede: usa fallback local
      console.warn('Backend indisponível, calculando localmente:', err);
      executeLocalCalculation(operandA, operandB, operation, symbol);
    }
  }

  function executeLocalCalculation(a, b, op, symbol) {
    let result = 0;
    if (op === 'add') result = a + b;
    else if (op === 'subtract') result = a - b;
    else if (op === 'multiply') result = a * b;
    else if (op === 'divide') {
      if (b === 0) {
        showToast('Divisão por zero não é permitida.');
        currentInput = 'Erro';
        subDisplay.textContent = `${a} ${symbol} ${b} =`;
        previousOperand = null;
        currentOperation = null;
        currentSymbol = null;
        shouldResetDisplay = true;
        updateDisplay(true);
        return;
      }
      result = a / b;
    }

    // Arredonda para evitar problemas com ponto flutuante
    result = Math.round(result * 1e8) / 1e8;
    currentInput = String(result);
    subDisplay.textContent = `${a} ${symbol} ${b} = ${result}`;

    addHistoryItemToDOM({
      expression: `${a} ${symbol} ${b} = ${result}`,
      result: result,
    });

    previousOperand = null;
    currentOperation = null;
    currentSymbol = null;
    shouldResetDisplay = true;
    updateDisplay();
  }

  // ==========================================
  // Histórico
  // ==========================================
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        renderHistory(data.history);
      }
    } catch {
      // Ignora erro se backend estiver offline
    }
  }

  function renderHistory(records) {
    historyList.innerHTML = '';

    if (records.length === 0) {
      historyList.innerHTML = '<div class="history-empty">Nenhum cálculo realizado ainda.</div>';
      return;
    }

    // Exibe do mais recente para o mais antigo
    records.slice().reverse().forEach((item) => {
      addHistoryItemToDOM(item);
    });
  }

  function addHistoryItemToDOM(item) {
    const emptyEl = historyList.querySelector('.history-empty');
    if (emptyEl) emptyEl.remove();

    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    itemEl.title = 'Clique para usar este resultado';
    itemEl.innerHTML = `
      <div class="calc-expression">${item.expression || ''}</div>
      <div class="calc-result">${item.result}</div>
    `;

    itemEl.addEventListener('click', () => {
      currentInput = String(item.result);
      shouldResetDisplay = true;
      updateDisplay();
    });

    historyList.prepend(itemEl);
  }

  async function clearHistory() {
    try {
      if (isApiOnline) {
        await fetch('/api/history', { method: 'DELETE' });
      }
    } catch (err) {
      console.warn('Erro ao limpar histórico no backend:', err);
    }
    historyList.innerHTML = '<div class="history-empty">Nenhum cálculo realizado ainda.</div>';
  }

  // ==========================================
  // Healthcheck do Backend
  // ==========================================
  async function checkBackendHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setOnlineStatus(true);
        loadHistory();
      } else {
        setOnlineStatus(false);
      }
    } catch {
      setOnlineStatus(false);
    }
  }

  function setOnlineStatus(online) {
    isApiOnline = online;
    if (online) {
      apiStatusBadge.className = 'api-badge online';
      apiStatusText.textContent = 'Backend Online';
    } else {
      apiStatusBadge.className = 'api-badge offline';
      apiStatusText.textContent = 'Modo Local (Offline)';
    }
  }

  // ==========================================
  // Event Listeners (Teclado & Botões)
  // ==========================================
  document.querySelector('.keypad-grid').addEventListener('click', (e) => {
    const target = e.target.closest('.btn');
    if (!target) return;

    if (target.dataset.num !== undefined) {
      inputDigit(target.dataset.num);
      return;
    }

    const action = target.dataset.action;
    if (action === 'decimal') {
      inputDecimal();
    } else if (action === 'all-clear') {
      allClear();
    } else if (action === 'delete') {
      deleteDigit();
    } else if (action === 'negate') {
      toggleSign();
    } else if (action === 'equals') {
      executeCalculation();
    } else if (target.dataset.symbol) {
      selectOperation(action, target.dataset.symbol, target);
    }
  });

  clearHistoryBtn.addEventListener('click', clearHistory);

  // Mapeamento de Teclado Físico
  window.addEventListener('keydown', (e) => {
    // Evita captura indevida se o usuário estiver focado em outro input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;

    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      inputDigit(key);
    } else if (key === '.' || key === ',') {
      e.preventDefault();
      inputDecimal();
    } else if (key === '+' || key === '-') {
      e.preventDefault();
      const op = key === '+' ? 'add' : 'subtract';
      const btn = document.querySelector(`.btn-op[data-action="${op}"]`);
      selectOperation(op, key, btn);
    } else if (key === '*' || key.toLowerCase() === 'x') {
      e.preventDefault();
      const btn = document.querySelector(`.btn-op[data-action="multiply"]`);
      selectOperation('multiply', '×', btn);
    } else if (key === '/') {
      e.preventDefault();
      const btn = document.querySelector(`.btn-op[data-action="divide"]`);
      selectOperation('divide', '÷', btn);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      executeCalculation();
    } else if (key === 'Backspace') {
      e.preventDefault();
      deleteDigit();
    } else if (key === 'Escape') {
      e.preventDefault();
      allClear();
    }
  });

  // Inicialização
  updateDisplay();
  checkBackendHealth();
  setInterval(checkBackendHealth, 15000); // Polling leve a cada 15s
});
