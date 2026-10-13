import cron, { type ScheduledTask } from "node-cron";
import pc from "picocolors";

export interface ScheduledJobConfig {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  runOnInit?: boolean;
  handler: () => Promise<void>;
}

export interface ScheduledJobState {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  isRunning: boolean;
  lastRunAt?: string;
  lastStatus?: "success" | "error" | "skipped";
  lastError?: string;
}

export class TaskScheduler {
  private jobs: Map<string, ScheduledJobConfig> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private states: Map<string, ScheduledJobState> = new Map();

  /**
   * Registra um novo job no agendador.
   */
  registerJob(jobConfig: ScheduledJobConfig): boolean {
    if (!cron.validate(jobConfig.cronExpression)) {
      console.error(
        pc.red(`[Scheduler] Expressão cron inválida para o job '${jobConfig.id}': "${jobConfig.cronExpression}"`)
      );
      return false;
    }

    this.jobs.set(jobConfig.id, jobConfig);
    this.states.set(jobConfig.id, {
      id: jobConfig.id,
      name: jobConfig.name,
      cronExpression: jobConfig.cronExpression,
      enabled: jobConfig.enabled,
      isRunning: false,
    });

    return true;
  }

  /**
   * Inicia o agendamento de um job específico.
   */
  startJob(id: string): boolean {
    const config = this.jobs.get(id);
    const state = this.states.get(id);

    if (!config || !state) {
      console.warn(pc.yellow(`[Scheduler] Tentativa de iniciar job inexistente: '${id}'`));
      return false;
    }

    // Se já tiver uma tarefa ativa para este ID, encerra antes de re-agendar
    this.stopJob(id);

    const task = cron.schedule(config.cronExpression, async () => {
      await this.runJob(id);
    });

    this.tasks.set(id, task);
    state.enabled = true;

    console.log(
      pc.gray(`[Scheduler] Job `) +
        pc.cyan(`'${config.name}'`) +
        pc.gray(` agendado: `) +
        pc.yellow(config.cronExpression)
    );

    if (config.runOnInit) {
      // Dispara em background logo após o agendamento
      void this.runJob(id);
    }

    return true;
  }

  /**
   * Para a execução agendada de um job específico.
   */
  stopJob(id: string): boolean {
    const task = this.tasks.get(id);
    const state = this.states.get(id);

    if (task) {
      task.stop();
      this.tasks.delete(id);
    }

    if (state) {
      state.enabled = false;
    }

    return true;
  }

  /**
   * Executa a rotina do job imediatamente (com controle de concorrência anti-sobreposição).
   */
  async runJob(id: string): Promise<boolean> {
    const config = this.jobs.get(id);
    const state = this.states.get(id);

    if (!config || !state) {
      console.warn(pc.yellow(`[Scheduler] Job '${id}' não encontrado para execução.`));
      return false;
    }

    if (state.isRunning) {
      console.warn(
        pc.yellow(
          `[Scheduler] Job '${config.name}' ignorado: uma execução anterior ainda está em andamento.`
        )
      );
      state.lastStatus = "skipped";
      return false;
    }

    state.isRunning = true;
    console.log(pc.cyan(`[Scheduler] Iniciando execução do job '${config.name}'...`));

    try {
      await config.handler();
      state.lastRunAt = new Date().toISOString();
      state.lastStatus = "success";
      state.lastError = undefined;
      console.log(pc.green(`[Scheduler] Job '${config.name}' finalizado com sucesso.`));
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.lastRunAt = new Date().toISOString();
      state.lastStatus = "error";
      state.lastError = errorMsg;
      console.error(pc.red(`[Scheduler] Erro durante a execução do job '${config.name}':`), error);
      return false;
    } finally {
      state.isRunning = false;
    }
  }

  /**
   * Inicia todos os jobs que estão marcados como habilitados.
   */
  startAll(): void {
    for (const [id, config] of this.jobs.entries()) {
      if (config.enabled) {
        this.startJob(id);
      }
    }
  }

  /**
   * Para todos os jobs agendados.
   */
  stopAll(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    for (const state of this.states.values()) {
      state.enabled = false;
    }
    console.log(pc.gray("[Scheduler] Todas as tarefas agendadas foram paradas."));
  }

  /**
   * Retorna os estados atuais de todos os jobs registrados.
   */
  getJobs(): ScheduledJobState[] {
    return Array.from(this.states.values());
  }

  /**
   * Verifica se um job está atualmente registrado.
   */
  hasJob(id: string): boolean {
    return this.jobs.has(id);
  }
}

