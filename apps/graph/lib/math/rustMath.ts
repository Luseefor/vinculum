import { parse, type MathNode } from "mathjs";
import { RUST_MATH_WASM_BASE64 } from "./rustMathArtifact";

interface MathCore {
  memory: WebAssembly.Memory;
  alloc_values(length: number): number;
  free_values(pointer: number, length: number): void;
  evaluate_values(program: number, length: number, scope: number, scopeLength: number): number;
}
let core: MathCore | null = null;
function getCore(): MathCore {
  if (!core) {
    const bytes = Uint8Array.from(atob(RUST_MATH_WASM_BASE64), (character) => character.charCodeAt(0));
    core = new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports as unknown as MathCore;
  }
  return core;
}
const allocations = new FinalizationRegistry<{ program: number; programLength: number; scope: number; scopeLength: number }>((allocation) => {
  const wasm = getCore();
  wasm.free_values(allocation.program, allocation.programLength);
  wasm.free_values(allocation.scope, allocation.scopeLength);
});
type Ast = MathNode & { value?: unknown; name?: string; op?: string; args?: MathNode[]; content?: MathNode; fn?: MathNode; condition?: MathNode; trueExpr?: MathNode; falseExpr?: MathNode };
const binary: Record<string, number> = { "+": 2, "-": 3, "*": 4, "/": 5, "^": 6, "%": 7, mod: 7, "==": 30, "!=": 31, "<": 32, "<=": 33, ">": 34, ">=": 35, and: 36, or: 37, xor: 38 };
const unary: Record<string, number> = { sin: 9, cos: 10, tan: 11, asin: 12, acos: 13, atan: 14, sqrt: 15, abs: 16, exp: 17, log: 18, ln: 18, floor: 19, ceil: 20, round: 21, sign: 22 };

/** Canonical AST -> bounded numerical program. Evaluation always runs in Rust,
 * including in workers and tests; no JavaScript evaluator or fallback exists. */
export function compileRustExpression(expression: string | MathNode): { evaluate(scope: Record<string, number>): number; readonly backend: "rust-wasm" } {
  const node = typeof expression === "string" ? parse(expression) : expression;
  const symbols: string[] = [];
  const program: number[] = [];
  const emit = (opcode: number, operand = 0) => program.push(opcode, operand);
  let count = 0;
  const walk = (node: MathNode, depth = 0): void => {
    if (++count > 2500 || depth > 128) throw new Error("Expression exceeds Rust execution limits.");
    const ast = node as Ast;
    if (ast.type === "ConstantNode") {
      if (typeof ast.value !== "number" && typeof ast.value !== "boolean") throw new Error("Only real numeric constants are supported.");
      emit(0, Number(ast.value)); return;
    }
    if (ast.type === "ParenthesisNode" && ast.content) { walk(ast.content, depth + 1); return; }
    if (ast.type === "SymbolNode") {
      if (ast.name === "pi" || ast.name === "e") { emit(0, ast.name === "pi" ? Math.PI : Math.E); return; }
      const name = ast.name!;
      let index = symbols.indexOf(name);
      if (index < 0) { index = symbols.length; symbols.push(name); }
      emit(1, index); return;
    }
    if (ast.type === "ConditionalNode" && ast.condition && ast.trueExpr && ast.falseExpr) {
      walk(ast.condition, depth + 1); const condition = program.length; emit(40);
      walk(ast.trueExpr, depth + 1); const jump = program.length; emit(41);
      program[condition + 1] = program.length; walk(ast.falseExpr, depth + 1); program[jump + 1] = program.length; return;
    }
    const args = ast.args ?? [];
    if (ast.type === "OperatorNode") {
      if (args.length === 1 && ["+", "-", "not"].includes(ast.op!)) {
        walk(args[0]!, depth + 1); if (ast.op !== "+") emit(ast.op === "-" ? 8 : 39); return;
      }
      const opcode = binary[ast.op!];
      if (opcode !== undefined && args.length === 2) { args.forEach((arg) => walk(arg, depth + 1)); emit(opcode); return; }
    }
    if (ast.type === "FunctionNode") {
      const name = (ast.fn as Ast)?.name ?? "";
      if (name === "min" || name === "max") {
        if (args.length === 0) { emit(0, name === "min" ? Infinity : -Infinity); return; }
        walk(args[0]!, depth + 1); args.slice(1).forEach((arg) => { walk(arg, depth + 1); emit(name === "min" ? 26 : 27); }); return;
      }
      if (["atan2", "pow", "log"].includes(name) && args.length === 2) { args.forEach((arg) => walk(arg, depth + 1)); emit(name === "atan2" ? 23 : name === "pow" ? 6 : 24); return; }
      if (name === "round" && args.length === 2) {
        const places = Number(args[1]!.toString());
        if (!Number.isInteger(places) || places < 0 || places > 15) throw new Error("Round precision must be an integer constant between 0 and 15.");
        walk(args[0]!, depth + 1); emit(25, places); return;
      }
      if (unary[name] !== undefined && args.length === 1) { walk(args[0]!, depth + 1); emit(unary[name]!); return; }
      throw new Error(`Unsupported function or argument count: ${name}.`);
    }
    throw new Error(`Unsupported expression node: ${ast.type}.`);
  };
  walk(node);
  const wasm = getCore();
  const programPointer = wasm.alloc_values(program.length);
  const scopePointer = wasm.alloc_values(symbols.length);
  if (!programPointer || !scopePointer) throw new Error("Rust math memory allocation failed.");
  new Float64Array(wasm.memory.buffer, programPointer, program.length).set(program);
  const compiled = {
    backend: "rust-wasm" as const,
    evaluate(scope: Record<string, number>): number {
      // WASM memory may grow when another expression is compiled. Refresh the
      // view instead of retaining a detached ArrayBuffer.
      const values = new Float64Array(wasm.memory.buffer, scopePointer, symbols.length);
      for (let index = 0; index < symbols.length; index++) {
        const name = symbols[index]!;
        if (!Object.hasOwn(scope, name)) throw new Error(`Undefined symbol ${name}`);
        values[index] = scope[name]!;
      }
      return wasm.evaluate_values(programPointer, program.length, scopePointer, symbols.length);
    }
  };
  allocations.register(compiled, { program: programPointer, programLength: program.length, scope: scopePointer, scopeLength: symbols.length });
  return compiled;
}
