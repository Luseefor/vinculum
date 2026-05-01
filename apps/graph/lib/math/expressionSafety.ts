import { parse } from "mathjs";
import type { MathNode } from "mathjs";
import { reportWarning } from "@/lib/monitoring/errorReporting";

export const MAX_EXPRESSION_LENGTH = 2048;
export const MAX_AST_NODE_COUNT = 2500;
export const MAX_LITERAL_MAGNITUDE = 1e9;

// Prevent parametric curve sampling from allocating huge arrays and freezing the editor.
export const MAX_PARAMETRIC_CURVE_SAMPLES = 8192;

export type ExpressionSafetyFailureCode =
  | "expression-too-long"
  | "invalid-expression-syntax"
  | "unsupported-function"
  | "unsupported-symbol"
  | "expression-too-complex"
  | "expression-disallowed-node"
  | "numeric-literal-out-of-range";

export interface ExpressionSafetyViolation {
  code: ExpressionSafetyFailureCode;
  message: string;
}

export interface ExpressionSafetyContext {
  operation: string;
  expressionLabel: string;
  objectId?: string;
  objectKind?: string;
  schemaVersion?: number;
  details?: Record<string, unknown>;
  allowedSymbols?: string[];
}

type SafetyCheckResult =
  | { ok: true }
  | { ok: false; violation: ExpressionSafetyViolation };

const BASE_ALLOWED_SYMBOLS = new Set(["x", "y", "z", "t", "pi", "e"]);

const ALLOWED_FUNCTIONS = new Set([
  // Trig / circular
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  // Roots / absolute / exp/log
  "sqrt",
  "abs",
  "exp",
  "log",
  "ln",
  // Power
  "pow",
  // Rounding
  "floor",
  "ceil",
  "round",
  "sign",
  // Aggregates used by built-in examples
  "max",
  "min"
]);

const DISALLOWED_NODE_TYPES = new Set([
  "AssignmentNode",
  "FunctionAssignmentNode",
  "BlockNode",
  "ObjectNode",
  "ArrayNode",
  "RangeNode",
  "ChainNode"
]);

export function validateExpressionSafety(expression: string, context: ExpressionSafetyContext): SafetyCheckResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: true };
  }

  if (trimmed.length > MAX_EXPRESSION_LENGTH) {
    const violation: ExpressionSafetyViolation = {
      code: "expression-too-long",
      message: "Expression is too long."
    };
    reportWarning("Expression safety violation: too long.", buildMonitoringContext(context, violation));
    return { ok: false, violation };
  }

  let node: MathNode;
  try {
    node = parse(trimmed) as MathNode;
  } catch {
    const violation: ExpressionSafetyViolation = {
      code: "invalid-expression-syntax",
      message: "Invalid expression syntax."
    };
    reportWarning("Expression safety violation: invalid syntax.", buildMonitoringContext(context, violation));
    return { ok: false, violation };
  }

  let nodeCount = 0;
  let complexityViolation: ExpressionSafetyViolation | null = null;
  let disallowedNodeViolation: ExpressionSafetyViolation | null = null;

  const inspectNode = (candidate: MathNode) => {
    nodeCount += 1;
    if (!complexityViolation && nodeCount > MAX_AST_NODE_COUNT) {
      complexityViolation = {
        code: "expression-too-complex",
        message: "Expression is too complex to render safely."
      };
    }

    const t = candidate.type;
    if (!disallowedNodeViolation && DISALLOWED_NODE_TYPES.has(t)) {
      disallowedNodeViolation = {
        code: "expression-disallowed-node",
        message: "This expression is not supported."
      };
    }
  };

  // `mathjs` node.forEach skips the root node; inspect the root explicitly.
  inspectNode(node);
  node.forEach((childNode: MathNode) => inspectNode(childNode));

  if (disallowedNodeViolation) {
    reportWarning("Expression safety violation: disallowed node.", buildMonitoringContext(context, disallowedNodeViolation));
    return { ok: false, violation: disallowedNodeViolation };
  }

  if (complexityViolation) {
    reportWarning(
      "Expression safety violation: too complex.",
      buildMonitoringContext(context, complexityViolation, { nodeCount })
    );
    return { ok: false, violation: complexityViolation };
  }

  const allowedSymbols = context.allowedSymbols?.length
    ? new Set([...BASE_ALLOWED_SYMBOLS, ...context.allowedSymbols])
    : null;

  const unsupportedFunction = findFirstUnsupportedFunction(node);
  if (unsupportedFunction) {
    const violation: ExpressionSafetyViolation = {
      code: "unsupported-function",
      message: `Unsupported function: ${unsupportedFunction}.`
    };
    reportWarning("Expression safety violation: unsupported function.", buildMonitoringContext(context, violation, { functionName: unsupportedFunction }));
    return { ok: false, violation };
  }

  const unsupportedSymbol = allowedSymbols ? findFirstUnsupportedSymbol(node, allowedSymbols) : null;
  if (unsupportedSymbol) {
    const violation: ExpressionSafetyViolation = {
      code: "unsupported-symbol",
      message: `Unsupported symbol: ${unsupportedSymbol}.`
    };
    reportWarning("Expression safety violation: unsupported symbol.", buildMonitoringContext(context, violation, { symbol: unsupportedSymbol }));
    return { ok: false, violation };
  }

  const numericOutOfRange = findFirstNumericLiteralOutOfRange(node);
  if (numericOutOfRange) {
    const violation: ExpressionSafetyViolation = {
      code: "numeric-literal-out-of-range",
      message: "Expression contains a numeric literal that is too large."
    };
    reportWarning(
      "Expression safety violation: numeric literal out of range.",
      buildMonitoringContext(context, violation, { magnitude: numericOutOfRange })
    );
    return { ok: false, violation };
  }

  return { ok: true };
}

export function formatNonFiniteEvaluationError(): string {
  return "Expression produced a non-finite value.";
}

function buildMonitoringContext(
  context: ExpressionSafetyContext,
  violation: ExpressionSafetyViolation,
  extraDetails: Record<string, unknown> = {}
): Parameters<typeof reportWarning>[1] {
  return {
    featureArea: "expression-eval",
    operation: context.operation,
    objectId: context.objectId,
    objectKind: context.objectKind,
    schemaVersion: context.schemaVersion,
    details: {
      expressionLabel: context.expressionLabel,
      errorCode: violation.code,
      ...extraDetails,
      ...(context.details ?? {})
    }
  };
}

function findFirstUnsupportedFunction(node: MathNode): string | null {
  let unsupported: string | null = null;

  const inspect = (candidate: MathNode) => {
    if (unsupported) return;
    const maybeFnNode = candidate as unknown as { type?: string; isFunctionNode?: boolean; fn?: unknown };
    const isFunctionNode = maybeFnNode.type === "FunctionNode" || Boolean(maybeFnNode.isFunctionNode);
    if (!isFunctionNode) return;

    const fnCandidate = maybeFnNode.fn;
    const fnName =
      typeof fnCandidate === "string"
        ? fnCandidate
        : (fnCandidate as unknown as { name?: unknown })?.name;

    if (typeof fnName !== "string") return;
    if (!ALLOWED_FUNCTIONS.has(fnName)) unsupported = fnName;
  };

  inspect(node);
  node.forEach((childNode: MathNode) => inspect(childNode));
  return unsupported;
}

function findFirstUnsupportedSymbol(node: MathNode, allowedSymbols: Set<string>): string | null {
  let unsupported: string | null = null;

  const inspect = (candidate: MathNode) => {
    if (unsupported) return;
    const maybeSymbol = candidate as unknown as { type?: string; isSymbolNode?: boolean; name?: unknown };
    const isSymbolNode = maybeSymbol.type === "SymbolNode" || Boolean(maybeSymbol.isSymbolNode);
    if (!isSymbolNode) return;
    if (typeof maybeSymbol.name !== "string") return;
    if (!allowedSymbols.has(maybeSymbol.name)) unsupported = maybeSymbol.name;
  };

  inspect(node);
  node.forEach((childNode: MathNode, path: string) => {
    // `mathjs` represents function names as a SymbolNode at `fn`.
    // Skip those so we don't accidentally reject whitelisted functions like `sin(...)`.
    if (path === "fn") {
      return;
    }
    inspect(childNode);
  });
  return unsupported;
}

function findFirstNumericLiteralOutOfRange(node: MathNode): number | null {
  let outOfRange: number | null = null;

  const inspect = (candidate: MathNode) => {
    if (outOfRange !== null) return;
    const maybeConstant = candidate as unknown as { type?: string; isConstantNode?: boolean; value?: unknown };
    const isConstantNode = maybeConstant.type === "ConstantNode" || Boolean(maybeConstant.isConstantNode);
    if (!isConstantNode) return;

    if (typeof maybeConstant.value !== "number") return;
    if (!Number.isFinite(maybeConstant.value)) return;

    const magnitude = Math.abs(maybeConstant.value);
    if (magnitude > MAX_LITERAL_MAGNITUDE) outOfRange = magnitude;
  };

  inspect(node);
  node.forEach((childNode: MathNode) => inspect(childNode));

  return outOfRange;
}

