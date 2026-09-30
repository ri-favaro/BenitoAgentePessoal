import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { PersonalAgent } from "./core/agent.js";
import { config } from "./config.js";

async function main() {
  const agent = new PersonalAgent();
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
  console.log(pc.gray(`• Busca Web: `) + pc.blue(`SearXNG (${config.searxng.baseUrl})`));
  console.log(pc.gray("--------------------------------------------------"));
  console.log(pc.dim("Comandos especiais: /memoria, /regras, /limpar, /sair, /ajuda"));
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

      if (trimmed === "/ajuda") {
        console.log(pc.cyan("\nComandos disponíveis:"));
        console.log(pc.bold("  /memoria ") + "- Exibe o perfil e notas salvas sobre você");
        console.log(pc.bold("  /regras  ") + "- Exibe o nome e diretrizes ativas do agente");
        console.log(pc.bold("  /limpar  ") + "- Limpa a sessão de contexto atual");
        console.log(pc.bold("  /sair    ") + "- Encerra o assistente\n");
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
