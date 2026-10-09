import { existsSync, readFileSync } from 'fs';

/**
 * Minimal `.env` loader (no dependency). Fills `process.env` with `KEY=value`
 * lines from `file` without overwriting variables already set by the shell, so
 * the CI/shell always wins over the committed-local file.
 */
export function loadDotEnv(file: string): void {
  if (!existsSync(file)) {
    return;
  }

  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.length > 0 && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
