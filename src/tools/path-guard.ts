import path from "node:path";

/**
 * Verifica se um caminho de destino (targetPath) está estritamente contido dentro
 * de um diretório pai (parentDir), tratando especificidades do Windows (case-insensitivity,
 * barras invertidas/normais e letras de unidade de disco).
 */
export function isPathInside(parentDir: string, targetPath: string): boolean {
  const resolvedParent = path.resolve(parentDir);
  const resolvedTarget = path.resolve(targetPath);

  const isWindows = process.platform === "win32";
  const normParent = isWindows ? resolvedParent.toLowerCase() : resolvedParent;
  const normTarget = isWindows ? resolvedTarget.toLowerCase() : resolvedTarget;

  const rel = path.relative(normParent, normTarget);

  // Está dentro se for o próprio diretório (rel === "")
  // ou um subcaminho relativo que não sobe de nível (!startsWith("..")) e não é absoluto (!isAbsolute)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export interface PathValidationResult {
  allowed: boolean;
  resolvedPath: string;
  error?: string;
}

/**
 * Valida se o targetPath pertence a pelo menos um dos diretórios autorizados.
 * Retorna o caminho absoluto canônico resolvido e a mensagem de erro caso o acesso seja negado.
 */
export function validateAllowedPath(
  targetPath: string,
  allowedDirs: string[]
): PathValidationResult {
  if (!targetPath || typeof targetPath !== "string") {
    return {
      allowed: false,
      resolvedPath: "",
      error: "Caminho inválido ou não fornecido.",
    };
  }

  const resolvedPath = path.resolve(targetPath);

  // Garante que todos os allowedDirs estejam resolvidos
  const canonicalAllowedDirs = allowedDirs.map((dir) => path.resolve(dir));

  const isAllowed = canonicalAllowedDirs.some((dir) => isPathInside(dir, resolvedPath));

  if (!isAllowed) {
    return {
      allowed: false,
      resolvedPath,
      error: `Acesso negado: o caminho '${resolvedPath}' está fora dos diretórios autorizados. Pastas permitidas: [${canonicalAllowedDirs.join(", ")}]`,
    };
  }

  return {
    allowed: true,
    resolvedPath,
  };
}
