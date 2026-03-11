import { basename } from "node:path";

export const CLI_NAME = "asp";
export const LEGACY_CLI_NAMES = ["acs", "agent-command-sync"];

export function getInvokedName(): string {
  return basename(process.argv[1] ?? CLI_NAME);
}

export function isLegacyInvocation(): boolean {
  const name = getInvokedName();
  return LEGACY_CLI_NAMES.some((legacy) => name === legacy || name.startsWith(`${legacy}.`));
}

export function showDeprecationWarning(): void {
  if (process.env.ASP_NO_DEPRECATION_WARNING === "1") return;
  if (!isLegacyInvocation()) return;
  const name = getInvokedName();
  console.error(`Warning: '${name}' is deprecated. Use 'asp' instead. Set ASP_NO_DEPRECATION_WARNING=1 to suppress.`);
}
