import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { PersonalAgent } from "./core/agent.js";
import { config } from "./config.js";
import { createFinanceTools, formatBRL, resolveMonthQuery } from "./tools/finance-tools.js";

async function main() {
  const agent = new PersonalAgent();
  const financeTools = createFinanceTools(config.finance.financeDir, config.filesystem.allowedPaths);
  const rl = readline.createInterface({ input, output });

  let agentName = await agent.memoryManager.getAgentName();

  console.log("\n" + pc.bold(pc.cyan("==================================================")));
  console.log(pc.bold(pc.cyan(`       ${agentName.toUpperCase()} - AGENTE PESSOAL LOCAL               `)));
  console.log(pc.bold(pc.cyan("==================================================")));
  console.log(pc.gray(`• Provedor atual: `) + pc.green(config.provider));
  if (config.provider === "ollama") {
    console.log(pc.gray(`• Modelo: `) + pc.yellow(config.ollama.model));
    console.log(pc.gray(`• Endpoint: `) + pc.blue(config.ollama.baseUrl));
  } else if (config.provider === "openai-compatible") {
    console.log(pc.gray(`• Modelo: `) + pc.yellow(config.openaiCompatible.model));
    console.log(pc.gray(`• Endpoint: `) + pc.blue(config.openaiCompatible.baseUrl));
  } else {
    console.log(pc.gray(`• Modelo: `) + pc.yellow(config.gemini.model));
  }
  console.log(pc.gray(`• Memória: `) + pc.magenta(config.memoryDir));
  const searchDesc =
    config.searchProvider === "tavily"
      ? `Tavily AI Search (api.tavily.com)`
      : `SearXNG (${config.searxng.baseUrl})`;
  console.log(pc.gray(`• Busca Web: `) + pc.blue(searchDesc));
  console.log(pc.gray("--------------------------------------------------"));
  console.log(pc.dim("Comandos especiais: /memoria, /regras, /aprendizados, /topicos, /consolidar, /limpar, /sair, /ajuda"));
  console.log("");
  while (true) {
    let userInput: string;
    try {
      userInput = await rl.question(pc.bold(pc.green("Você: ")));
    } catch {
      // stdin encerrado ou terminal fechado
      break;
    }

    try {
      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (trimmed === "/sair" || trimmed.toLowerCase() === "sair") {
        console.log(pc.cyan(`\nAté logo, Luiz!\n`));
        break;
      }

      if (trimmed === "/limpar") {
        agent.clearHistory();
        console.log(pc.yellow("\nHistórico da conversa atual limpo com sucesso.\n"));
        continue;
      }

      if (trimmed === "/memoria") {
        const profile = await agent.memoryManager.readProfile();
        console.log(pc.cyan("\n--- MEMÓRIA DO USUÁRIO ---"));
        console.log(profile);
        console.log(pc.cyan("--------------------------\n"));
        continue;
      }

      if (trimmed === "/regras") {
        const rules = await agent.memoryManager.readRules();
        console.log(pc.cyan("\n--- REGRAS E PERSONA DO AGENTE ---"));
        console.log(rules);
        console.log(pc.cyan("----------------------------------\n"));
        continue;
      }

      if (trimmed === "/aprendizados") {
        const learnings = await agent.memoryManager.readLearnings();
        console.log(pc.cyan("\n--- APRENDIZADOS E FEEDBACKS OPERACIONAIS ---"));
        console.log(learnings);
        console.log(pc.cyan("---------------------------------------------\n"));
        continue;
      }

      if (trimmed === "/topicos") {
        const topics = await agent.memoryManager.listTopics();
        console.log(pc.cyan("\n--- TÓPICOS DE MEMÓRIA MODULAR (memory/topics/) ---"));
        if (topics.length === 0) {
          console.log(pc.gray("Nenhum tópico criado ainda. Use /consolidar para organizar seus aprendizados em tópicos."));
        } else {
          for (const t of topics) {
            console.log(
              pc.bold(pc.green(`• ${t.slug}`)) +
                pc.gray(` (${t.title}): `) +
                t.description +
                pc.yellow(` [${t.count} regra${t.count === 1 ? "" : "s"}]`)
            );
          }
        }
        console.log(pc.cyan("---------------------------------------------------\n"));
        continue;
      }

      if (trimmed.startsWith("/topico ")) {
        const slug = trimmed.replace("/topico ", "").trim();
        const content = await agent.memoryManager.readTopic(slug);
        if (!content) {
          console.log(
            pc.red(
              `\nTópico '${slug}' não encontrado. Digite /topicos para listar os tópicos existentes.\n`
            )
          );
        } else {
          console.log(pc.cyan(`\n--- TÓPICO: ${slug.toUpperCase()} ---`));
          console.log(content);
          console.log(pc.cyan("-------------------------------------\n"));
        }
        continue;
      }

      if (trimmed === "/consolidar") {
        const history = agent.getHistory();
        const hasSessionHistory = history.length > 0;
        console.log(
          pc.yellow(
            hasSessionHistory
              ? `\n[🧠 Benito está analisando a conversa recente (${history.length} mensagens) e consolidando a memória em tópicos...]`
              : "\n[🧠 Benito está consolidando, desduplicando e organizando a memória em tópicos...]"
          )
        );
        try {
          const result = await agent.memoryManager.consolidateMemory(
            undefined,
            history
          );
          if (result.success) {
            console.log(pc.green("\n✔ Memória consolidada e modularizada com sucesso!"));
            console.log(pc.cyan("\nResumo da Consolidação:"));
            console.log(result.summary);
            console.log("");
          } else {
            console.log(pc.red(`\n✖ Falha na consolidação: ${result.summary}\n`));
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(pc.red(`\n✖ Erro ao consolidar memória: ${msg}\n`));
        }
        continue;
      }

      if (trimmed === "/financas" || trimmed.startsWith("/financas ")) {
        console.log(pc.cyan("\n[📊 Consultando extrato financeiro no cofre do Obsidian...]"));
        try {
          const argsText = trimmed.replace("/financas", "").trim();
          const query = resolveMonthQuery(argsText);

          const summaryResult: any = await (financeTools.get_financial_summary as any).execute({
            month: query.yearMonth,
            wallet: query.wallet,
          });

          if (!summaryResult.success) {
            console.log(pc.red(`\n✖ Erro ao consultar finanças: ${summaryResult.error}\n`));
          } else {
            console.log(pc.bold(pc.cyan(`\n=== 💰 EXTRATO FINANCEIRO - ${summaryResult.monthTitle.toUpperCase()} ===`)));
            
            if (summaryResult.wallets) {
              for (const [wKey, wData] of Object.entries<any>(summaryResult.wallets)) {
                if (wKey === "conta_corrente") {
                  console.log(pc.bold("\n💳 Conta Corrente (Salário & Dinheiro Livre):"));
                  console.log(pc.green(`  • Receitas:    ${formatBRL(wData.totalIncome)}`));
                  console.log(pc.red(`  • Despesas:    ${formatBRL(wData.totalExpense)}`));
                  console.log(pc.bold(`  • Saldo Livre: ${formatBRL(wData.balance)}`));
                } else if (wKey === "va") {
                  console.log(pc.bold("\n🍎 Vale Alimentação (VA):"));
                  console.log(pc.green(`  • Benefício:   ${formatBRL(wData.totalIncome)}`));
                  console.log(pc.red(`  • Gastos no VA: ${formatBRL(wData.totalExpense)}`));
                  console.log(pc.bold(`  • Saldo Restante: ${formatBRL(wData.balance)}`));
                } else {
                  console.log(pc.bold(`\n📁 ${wData.label}:`));
                  console.log(pc.green(`  • Entradas:    ${formatBRL(wData.totalIncome)}`));
                  console.log(pc.red(`  • Saídas:      ${formatBRL(wData.totalExpense)}`));
                  console.log(pc.bold(`  • Saldo:       ${formatBRL(wData.balance)}`));
                }
              }
            } else {
              console.log(pc.green(`• Receitas Totais:  ${summaryResult.totalIncome}`));
              console.log(pc.red(`• Despesas Totais:  ${summaryResult.totalExpense}`));
              console.log(pc.bold(`• Saldo Líquido:    ${summaryResult.balance}`));
            }

            if (summaryResult.masterBalances) {
              console.log(pc.bold(pc.magenta("\n🏦 Saldos Acumulados (Saldo Mestre em Tempo Real):")));
              for (const [, wState] of Object.entries<any>(summaryResult.masterBalances)) {
                console.log(pc.magenta(`  • ${wState.label}: ${formatBRL(wState.balance)}`));
              }
            }

            console.log(pc.yellow(`\n⏱️ Ritmo Médio (Conta Corrente): ${summaryResult.dailyBurnRate}/dia`));
            if (summaryResult.burnAlert) {
              console.log(pc.bold(pc.yellow(`\n${summaryResult.burnAlert}`)));
            }
            if (summaryResult.expenseCategories && summaryResult.expenseCategories.length > 0) {
              console.log(pc.cyan("\nPrincipais Despesas por Categoria:"));
              for (const cat of summaryResult.expenseCategories.slice(0, 5)) {
                console.log(`  - ${cat.category}: ${cat.total}`);
              }
            }
            console.log(pc.cyan("========================================================\n"));
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(pc.red(`\n✖ Erro: ${msg}\n`));
        }
        continue;
      }

      if (trimmed === "/ajuda") {
        console.log(pc.cyan("\nComandos disponíveis:"));
        console.log(pc.bold("  /financas     ") + "- Exibe o extrato financeiro e saldo do mês no Obsidian");
        console.log(pc.bold("  /memoria      ") + "- Exibe o perfil e notas salvas sobre você");
        console.log(pc.bold("  /regras       ") + "- Exibe o nome e diretrizes ativas do agente");
        console.log(pc.bold("  /aprendizados ") + "- Exibe as lições aprendidas e feedbacks operacionais gerais");
        console.log(pc.bold("  /topicos      ") + "- Lista os tópicos de memória modular especializada (memory/topics/)");
        console.log(pc.bold("  /topico <nome>") + "- Exibe o conteúdo de um tópico específico (ex: /topico web-search)");
        console.log(pc.bold("  /consolidar   ") + "- Sintetiza, desduplica e organiza a memória em subpastas por tópicos");
        console.log(pc.bold("  /limpar       ") + "- Limpa a sessão de contexto atual");
        console.log(pc.bold("  /sair         ") + "- Encerra o assistente\n");
        continue;
      }

      // Atualiza o nome caso tenha sido alterado dinamicamente
      agentName = await agent.memoryManager.getAgentName();
      process.stdout.write(pc.bold(pc.cyan(`${agentName}: `)));

      await agent.ask(trimmed, {
        onToken: (token) => {
          process.stdout.write(token);
        },
        onToolCall: (toolName, args) => {
          if (toolName === "save_memory") {
            const fact = (args as { fact?: string })?.fact || "";
            process.stdout.write(
              pc.dim(pc.yellow(`\n[🧠 Memória: salvando "${fact}"]\n${agentName}: `))
            );
          } else if (toolName === "save_learning") {
            const lesson = (args as { lesson?: string })?.lesson || "";
            process.stdout.write(
              pc.dim(pc.green(`\n[💡 Aprendizado: salvando lição "${lesson}"]\n${agentName}: `))
            );
          } else if (toolName === "update_persona") {
            const newName = (args as { newName?: string })?.newName;
            const style = (args as { styleOrRule?: string })?.styleOrRule;
            const info = newName ? `novo nome "${newName}"` : style || "estilo";
            process.stdout.write(
              pc.dim(pc.magenta(`\n[🎭 Identidade: atualizando ${info}]\n${agentName}: `))
            );
          } else if (toolName === "write_file") {
            const filePath = (args as { filePath?: string })?.filePath || "";
            process.stdout.write(
              pc.dim(pc.cyan(`\n[📁 Arquivo: criando "${filePath}"]\n${agentName}: `))
            );
          } else if (toolName === "read_file") {
            const filePath = (args as { filePath?: string })?.filePath || "";
            process.stdout.write(
              pc.dim(pc.blue(`\n[📖 Arquivo: lendo "${filePath}"]\n${agentName}: `))
            );
          } else if (toolName === "list_directory") {
            const dirPath = (args as { dirPath?: string })?.dirPath || "";
            process.stdout.write(
              pc.dim(pc.magenta(`\n[📂 Pasta: listando "${dirPath}"]\n${agentName}: `))
            );
          } else if (toolName === "search_web") {
            const query = (args as { query?: string })?.query || "";
            process.stdout.write(
              pc.dim(pc.cyan(`\n[🌐 Web: buscando "${query}"]\n${agentName}: `))
            );
          } else if (toolName === "fetch_web_page") {
            const url = (args as { url?: string })?.url || "";
            process.stdout.write(
              pc.dim(pc.blue(`\n[📄 Web: lendo página "${url}"]\n${agentName}: `))
            );
          } else if (toolName === "read_topic_memory") {
            const topicSlug = (args as { topicSlug?: string })?.topicSlug || "";
            process.stdout.write(
              pc.dim(pc.magenta(`\n[📂 Memória: consultando tópico "${topicSlug}"]\n${agentName}: `))
            );
          } else if (toolName === "save_topic_learning") {
            const topicSlug = (args as { topicSlug?: string })?.topicSlug || "";
            const lesson = (args as { lesson?: string })?.lesson || "";
            process.stdout.write(
              pc.dim(pc.green(`\n[💡 Memória: gravando regra no tópico "${topicSlug}" ("${lesson}")]\n${agentName}: `))
            );
          } else if (toolName === "list_memory_topics") {
            process.stdout.write(
              pc.dim(pc.magenta(`\n[📂 Memória: listando tópicos modulares]\n${agentName}: `))
            );
          } else if (toolName === "record_expense") {
            const amount = (args as { amount?: number })?.amount || 0;
            const desc = (args as { description?: string })?.description || "";
            process.stdout.write(
              pc.dim(pc.yellow(`\n[💸 Finanças: registrando despesa de ${formatBRL(amount)} ("${desc}")]\n${agentName}: `))
            );
          } else if (toolName === "record_income") {
            const amount = (args as { amount?: number })?.amount || 0;
            const desc = (args as { description?: string })?.description || "";
            process.stdout.write(
              pc.dim(pc.green(`\n[💰 Finanças: registrando receita de ${formatBRL(amount)} ("${desc}")]\n${agentName}: `))
            );
          } else if (toolName === "cancel_last_transaction") {
            process.stdout.write(
              pc.dim(pc.red(`\n[↩️ Finanças: desfazendo lançamento]\n${agentName}: `))
            );
          } else if (toolName === "adjust_wallet_balance") {
            const w = (args as { wallet?: string })?.wallet || "carteira";
            const amt = (args as { newBalance?: number })?.newBalance || 0;
            process.stdout.write(
              pc.dim(pc.yellow(`\n[⚖️ Finanças: ajustando saldo de ${w} para ${formatBRL(amt)}]\n${agentName}: `))
            );
          } else if (toolName === "get_financial_summary") {
            process.stdout.write(
              pc.dim(pc.cyan(`\n[📊 Finanças: consultando extrato no Obsidian]\n${agentName}: `))
            );
          }
        },
      });

      console.log("\n");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(pc.red(`\nErro: ${errorMsg}\n`));
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Falha ao iniciar o agente:", err);
  process.exit(1);
});
