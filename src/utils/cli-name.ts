import { basename } from "node:path";

export const CLI_NAME = "sk";
export const LEGACY_CLI_NAMES = ["asp", "acs", "agent-command-sync"];

export function getInvokedName(): string {
  return basename(process.argv[1] ?? CLI_NAME);
}

export function isLegacyInvocation(): boolean {
  const name = getInvokedName();
  return LEGACY_CLI_NAMES.some((legacy) => name === legacy || name.startsWith(`${legacy}.`));
}

export function showDeprecationWarning(): void {
  if (process.env.SK_NO_DEPRECATION_WARNING === "1") return;
  if (!isLegacyInvocation()) return;
  const name = getInvokedName();
  console.error(`Warning: '${name}' is deprecated. Use 'sk' instead. Set SK_NO_DEPRECATION_WARNING=1 to suppress.`);
}
