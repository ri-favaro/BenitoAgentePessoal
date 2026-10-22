import { tool } from "ai";
import { z } from "zod";

export interface CalculatorToolsConfig {
  flaskBaseUrl?: string;
}

/**
 * Utilitário de formatação numérica com arredondamento seguro para evitar
 * imperfeições de ponto flutuante em JavaScript.
 */
function formatNumber(value: number, precision = 8): number {
  if (!Number.isFinite(value)) {
    throw new Error("O resultado não é um número finito.");
  }
  const factor = Math.pow(10, precision);
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Cria o conjunto de ferramentas da Calculadora expostas ao agente Benito.
 */
export function createCalculatorTools(options?: CalculatorToolsConfig) {
  const flaskUrl = options?.flaskBaseUrl || "http://127.0.0.1:5050";

  return {
    calculate: tool({
      description:
        "Executa cálculos aritméticos básicos fundamentais (adição, subtração, multiplicação e divisão) com tratamento seguro de erros e formatação numérica precisa.",
      parameters: z.object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe(
            "Operação matemática a ser executada: 'add' (adição), 'subtract' (subtração), 'multiply' (multiplicação) ou 'divide' (divisão)."
          ),
        a: z.number().describe("Primeiro operando numérico."),
        b: z.number().describe("Segundo operando numérico."),
      }),
      execute: async ({ operation, a, b }) => {
        try {
          if (!Number.isFinite(a) || !Number.isFinite(b)) {
            return {
              success: false,
              error: "Os operandos 'a' e 'b' devem ser números finitos válidos.",
            };
          }

          let result: number;
          let symbol: string;

          switch (operation) {
            case "add":
              result = a + b;
              symbol = "+";
              break;
            case "subtract":
              result = a - b;
              symbol = "-";
              break;
            case "multiply":
              result = a * b;
              symbol = "×";
              break;
            case "divide":
              if (b === 0) {
                return {
                  success: false,
                  error: "Divisão por zero não é permitida.",
                  code: "DIVISION_BY_ZERO",
                };
              }
              result = a / b;
              symbol = "÷";
              break;
            default:
              return {
                success: false,
                error: `Operação não suportada: ${operation}`,
              };
          }

          const formattedResult = formatNumber(result);
          const expression = `${formatNumber(a)} ${symbol} ${formatNumber(b)} = ${formattedResult}`;

          return {
            success: true,
            operation,
            symbol,
            a: formatNumber(a),
            b: formatNumber(b),
            result: formattedResult,
            expression,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar cálculo: ${error.message}`,
          };
        }
      },
    }),

    get_calculator_status: tool({
      description:
        "Verifica a integridade e disponibilidade da interface web da Calculadora Benito (backend Flask) e retorna o status atual e URL de acesso.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          try {
            const response = await fetch(`${flaskUrl}/api/health`, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const data = (await response.json()) as { service?: string };
              return {
                success: true,
                status: "online",
                url: flaskUrl,
                service: data.service || "benito-calculadora",
                message: `Servidor da Calculadora Python (Flask) ativo e operante em ${flaskUrl}.`,
              };
            }
          } catch {
            // Servidor offline ou indisponível
          }

          return {
            success: true,
            status: "offline",
            url: flaskUrl,
            message:
              "O servidor da Calculadora Python está offline. Você pode iniciá-lo executando 'npm run calculator' ou 'py tools/calculadora/app.py'.",
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao consultar status da calculadora: ${error.message}`,
          };
        }
      },
    }),
  };
}
