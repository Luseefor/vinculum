const MAX_ERROR_LENGTH = 92;

export function formatExpressionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const firstLine = error.message.split("\n")[0]?.trim() ?? "Invalid expression.";
    return truncate(firstLine.replace(/^Error:\s*/i, ""));
  }

  return "Invalid expression.";
}

function truncate(value: string): string {
  if (value.length <= MAX_ERROR_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_ERROR_LENGTH - 1)}…`;
}
