# Tópico: Capacidade de Hardware & IA Local
Descrição: Restrições físicas de VRAM (RTX 4070 Ti 12GB), limites de parâmetros e busca dinâmica

- RESTRIÇÃO DE HARDWARE (RTX 4070 Ti com 12GB de VRAM):
  - Faixa Leve e Rápida (7B a 9B parâmetros em Q4/Q5/Q8): Ocupa de 5 a 7 GB de VRAM, permitindo velocidades altas (>60-90 tok/s) com margem confortável para contexto longo (8k a 16k tokens) e uso simultâneo de outras aplicações na GPU.
  - Faixa Limite para Aceleração 100% GPU (12B a 14B parâmetros em Q4): Ocupa ~8.5 a 9.5 GB de VRAM, rodando a ~35-45 tok/s com contexto de 8k tokens. É o teto ideal de capacidade de raciocínio acelerado sem offload.
  - Inviabilidade de Modelos Grandes (>20B, 30B, 70B): Modelos acima de 14B não cabem nos 12GB de VRAM com contexto e transbordam para a memória RAM/CPU, caindo drasticamente a velocidade (<5 tok/s). NUNCA recomende modelos dessa faixa quando o usuário pedir velocidade na GPU.
- DESCOBERTA DINÂMICA DE MODELOS (ZERO MEMÓRIA FÓSSIL):
  - NUNCA assuma nem recite uma lista estática de "melhores modelos" gravada na memória, pois o ecossistema de modelos de código aberto evolui continuamente.
  - Quando o usuário pedir recomendações de modelos atuais, use search_web buscando as novidades que se enquadrem nas faixas de parâmetros da GPU do usuário (ex: 'best local llm tool calling 14b 8b ollama').
