# 🧮 Benito Calculadora - Ferramenta Modular em Python com Interface HTML

Calculadora moderna desenvolvida com backend Python (Flask) e interface web responsiva (HTML5, CSS3 e Vanilla JavaScript).

---

## 📌 Visão Geral & Arquitetura

Esta aplicação foi desenvolvida como utilitário e ferramenta de demonstração no ecossistema do **Benito Agente Pessoal**:

- **Backend (`calculator.py`):** Módulo matemático desacoplado, com tipagem estrita (type hints do Python 3), dataclasses, enums e tratamento rigoroso de exceções (como divisão por zero e operandos inválidos).
- **Servidor Web (`app.py`):** Aplicação Flask expondo rotas para renderização do frontend e endpoints RESTful (`/api/calculate`, `/api/history`, `/api/health`).
- **Frontend Responsivo (`templates/index.html`, `static/style.css`, `static/script.js`):**
  - Design Dark Mode moderno com tipografia monoespaçada (JetBrains Mono).
  - Suporte completo a atalhos de teclado físico (0-9, +, -, *, /, Enter, Backspace, Esc).
  - Painel de histórico interativo com clique para reutilização do resultado.
  - Fallback local resiliente caso o backend Flask não esteja rodando.

---

## 🚀 Como Executar

### 1. Pré-requisitos
- Python 3.10+ instalado.
- Instalação das dependências:
  ```bash
  pip install -r requirements.txt
  ```

### 2. Iniciar o Servidor Flask
A partir da raiz do projeto Benito ou dentro desta pasta:
```bash
# Via script npm configurado no Benito:
npm run calculator

# Ou diretamente pelo Python:
py tools/calculadora/app.py
```

A interface estará disponível em: **`http://127.0.0.1:5050`**

---

## 📡 Endpoints da API REST

| Método | Endpoint | Descrição | Exemplo de Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Renderiza a interface web da calculadora | - |
| `GET` | `/api/health` | Healthcheck de integridade do serviço | - |
| `POST` | `/api/calculate` | Executa cálculo aritmético (`add`, `subtract`, `multiply`, `divide`) | `{"operation": "divide", "a": 10, "b": 2}` |
| `GET` | `/api/history` | Retorna a lista dos cálculos recentes | - |
| `DELETE` | `/api/history` | Limpa o histórico de cálculos | - |

---

## 🧪 Testes Automatizados

A suíte de testes em Python pode ser executada com o `unittest` nativo:
```bash
py -m unittest tools/calculadora/test_calculator.py
```
