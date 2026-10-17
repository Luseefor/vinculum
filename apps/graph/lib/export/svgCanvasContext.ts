/** Records the path operations used by the canonical graph painter as SVG. */
export function createSvgCanvasContext(idPrefix = "graph") {
  const elements: string[] = [];
  const definitions: string[] = [];
  let path: string[] = [];
  let clips: string[] = [];
  const states: Array<{ strokeStyle: string; fillStyle: string; lineWidth: number; lineCap: CanvasLineCap; lineJoin: CanvasLineJoin; globalAlpha: number; font: string; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline; clips: string[] }> = [];
  const number = (value: number) => Number.isFinite(value) ? value.toFixed(2) : "0";
  function paint(markup: string) {
    elements.push(clips.reduceRight((child, id) => `<g clip-path="url(#${id})">${child}</g>`, markup));
  }
  function colorAttributes(kind: "fill" | "stroke", color: string) {
    const alpha = /^#[\da-f]{8}$/i.test(color) ? parseInt(color.slice(7), 16) / 255 : 1;
    const value = alpha === 1 ? color : color.slice(0, 7);
    return `${kind}="${escapeSvgAttribute(value)}" ${kind}-opacity="${number(context.globalAlpha * alpha)}"`;
  }
  const context = {
    strokeStyle: "#000000", fillStyle: "#000000", lineWidth: 1,
    lineCap: "butt" as CanvasLineCap, lineJoin: "miter" as CanvasLineJoin, globalAlpha: 1, font: "10px sans-serif", textAlign: "start" as CanvasTextAlign, textBaseline: "alphabetic" as CanvasTextBaseline,
    save() { states.push({ strokeStyle: this.strokeStyle, fillStyle: this.fillStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, lineJoin: this.lineJoin, globalAlpha: this.globalAlpha, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, clips: [...clips] }); },
    restore() { const state = states.pop(); if (state) { const { clips: savedClips, ...styles } = state; clips = savedClips; Object.assign(this, styles); } },
    beginPath() { path = []; },
    closePath() { path.push("Z"); },
    moveTo(x: number, y: number) { path.push(`M ${number(x)} ${number(y)}`); },
    lineTo(x: number, y: number) { path.push(`L ${number(x)} ${number(y)}`); },
    rect(x: number, y: number, width: number, height: number) { path.push(`M ${number(x)} ${number(y)} h ${number(width)} v ${number(height)} h ${number(-width)} Z`); },
    arc(x: number, y: number, radius: number, start: number, end: number, counterclockwise = false) {
      const span = Math.min(Math.PI * 2, Math.abs(end - start));
      const direction = counterclockwise ? -1 : 1;
      const steps = Math.max(1, Math.ceil(span / Math.PI));
      this.moveTo(x + radius * Math.cos(start), y + radius * Math.sin(start));
      for (let step = 1; step <= steps; step++) {
        const angle = start + direction * span * step / steps;
        path.push(`A ${number(radius)} ${number(radius)} 0 0 ${counterclockwise ? 0 : 1} ${number(x + radius * Math.cos(angle))} ${number(y + radius * Math.sin(angle))}`);
      }
    },
    clip() {
      const id = `${idPrefix}-clip-${definitions.length}`;
      definitions.push(`<clipPath id="${id}"><path d="${path.join(" ")}" /></clipPath>`);
      clips.push(id);
    },
    fill() { if (path.length) paint(`<path d="${path.join(" ")}" ${colorAttributes("fill", this.fillStyle)} />`); },
    stroke() { if (path.length) paint(`<path d="${path.join(" ")}" fill="none" ${colorAttributes("stroke", this.strokeStyle)} stroke-width="${number(this.lineWidth)}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}" />`); },
    fillText(text: string, x: number, y: number) {
      const anchor = this.textAlign === "center" ? "middle" : this.textAlign === "right" || this.textAlign === "end" ? "end" : "start";
      const baseline = this.textBaseline === "top" ? "text-before-edge" : this.textBaseline === "middle" ? "central" : this.textBaseline === "bottom" ? "text-after-edge" : "alphabetic";
      paint(`<text x="${number(x)}" y="${number(y)}" ${colorAttributes("fill", this.fillStyle)} text-anchor="${anchor}" dominant-baseline="${baseline}" style="font:${escapeSvgAttribute(this.font)}">${escapeSvgAttribute(text)}</text>`);
    },
    fillRect(x: number, y: number, width: number, height: number) { paint(`<rect x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" ${colorAttributes("fill", this.fillStyle)} />`); }
  };
  return { context: context as unknown as CanvasRenderingContext2D, elements, definitions };
}

export function escapeSvgAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;");
}
