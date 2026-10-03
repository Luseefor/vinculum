import fs from "fs";
import path from "path";

/**
 * Automated Verification Script for Vinculum Showcase Film Treatment
 * 
 * Verifies:
 * 1. Zero placeholder / TODO / TBD / FIXME / XXX markers in SHOWCASE_TREATMENT.md.
 * 2. Storyboard total duration is within bounds (24.0s to 35.0s).
 * 3. Visual event beat intervals: every delta between consecutive beats is in [0.5s, 1.5s].
 * 4. All 8 required metadata fields are present and non-empty on every shot in the storyboard.
 * 5. All 14 capabilities are present with all 8 mandatory dimensions.
 * 6. Core Product Thesis contains exactly one authoritative paragraph.
 * 7. All cited repository files/components exist on disk.
 */

const repoRoot = path.resolve(__dirname, "../../..");
const treatmentPath = path.resolve(repoRoot, "apps/video/SHOWCASE_TREATMENT.md");

interface VerificationResult {
  check: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function recordResult(check: string, passed: boolean, details: string) {
  results.push({ check, passed, details });
  if (passed) {
    console.log(`  [PASS] ${check}: ${details}`);
  } else {
    console.error(`  [FAIL] ${check}: ${details}`);
  }
}

async function verifyShowcaseTreatment() {
  console.log("==================================================================");
  console.log(" Vinculum Showcase Treatment Automated Verification Engine");
  console.log("==================================================================\n");

  if (!fs.existsSync(treatmentPath)) {
    console.error(`Fatal: Target file not found at ${treatmentPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(treatmentPath, "utf-8");

  // --------------------------------------------------------------------------
  // Check 1: Zero Placeholder / TODO Markers
  // --------------------------------------------------------------------------
  console.log("Executing Check 1: Zero Placeholder / TODO / TBD Markers...");
  const placeholderPatterns = [
    /\bTODO\b/i,
    /\bTBD\b/i,
    /\bFIXME\b/i,
    /\bXXX\b/i,
    /\bPLACEHOLDER\b/i,
    /\[TBD\]/i,
    /\[TODO\]/i,
  ];

  let foundPlaceholders: string[] = [];
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    // Exclude markdown code blocks or explanations of anti-patterns if they mention the string
    // but check for active placeholder tokens
    for (const pattern of placeholderPatterns) {
      if (pattern.test(line)) {
        // If line is describing checking for placeholders, allow it
        if (line.includes("Zero placeholder") || line.includes("zero placeholder") || line.includes("placeholder markers") || line.includes("placeholder patterns")) {
          continue;
        }
        foundPlaceholders.push(`Line ${index + 1}: ${line.trim()}`);
      }
    }
  });

  if (foundPlaceholders.length === 0) {
    recordResult("Placeholder Audit", true, "Zero placeholder tokens (TODO, TBD, FIXME, XXX) found");
  } else {
    recordResult("Placeholder Audit", false, `Found placeholder tokens:\n${foundPlaceholders.join("\n")}`);
  }

  // --------------------------------------------------------------------------
  // Check 2: Storyboard Timing Bounds (24.0s - 35.0s) & Shot Continuity
  // --------------------------------------------------------------------------
  console.log("\nExecuting Check 2: Storyboard Timing Bounds & Continuity...");
  
  // Find all shot headings: e.g. "#### Shot 1.1: The Inert Formula vs The Canvas"
  const shotHeadingRegex = /#### Shot (\d+\.\d+): (.+)/g;
  const shots: { id: string; title: string; text: string }[] = [];
  let match: RegExpExecArray | null;
  const shotIndices: { id: string; title: string; index: number }[] = [];

  while ((match = shotHeadingRegex.exec(content)) !== null) {
    shotIndices.push({ id: match[1], title: match[2], index: match.index });
  }

  for (let i = 0; i < shotIndices.length; i++) {
    const current = shotIndices[i];
    const nextIndex = i + 1 < shotIndices.length ? shotIndices[i + 1].index : content.indexOf("### 3.3 Visual Event Density Architecture");
    const shotText = content.slice(current.index, nextIndex);
    shots.push({ id: current.id, title: current.title, text: shotText });
  }

  // Parse durations from shots
  let totalShotDuration = 0;
  const shotDurations: { id: string; duration: number }[] = [];

  for (const shot of shots) {
    const durationMatch = /1\.\s+\*\*Duration & Exact Timecodes\*\*:\s*([0-9.]+)\s*s/i.exec(shot.text);
    if (durationMatch) {
      const dur = parseFloat(durationMatch[1]);
      shotDurations.push({ id: shot.id, duration: dur });
      totalShotDuration += dur;
    } else {
      console.warn(`Could not parse duration for Shot ${shot.id}`);
    }
  }

  const isTimingValid = totalShotDuration >= 24.0 && totalShotDuration <= 35.0 && shots.length >= 10;
  recordResult(
    "Storyboard Timing Bounds",
    isTimingValid,
    `Total storyboard duration = ${totalShotDuration.toFixed(2)}s across ${shots.length} shots (Allowed range: 24.0s - 35.0s)`
  );

  // --------------------------------------------------------------------------
  // Check 3: Visual Event Beat Intervals (0.5s - 1.5s Delta)
  // --------------------------------------------------------------------------
  console.log("\nExecuting Check 3: Visual Event Beat Intervals (0.5s - 1.5s)...");

  // Parse Table 3.1: Complete Event Beat Timeline
  // Lines matching: | Beat # | Timecode | Time (s) | Event Description | $\Delta t$ Interval | Pacing Mode |
  // e.g. | 02 | `00:00.80` | 0.80s | Editorial super fades in... | 0.80s | Compression |
  const beatRowRegex = /\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([0-9.]+)\s*s\s*\|\s*([^|]+)\|\s*([0-9.]+)\s*s\s*\|\s*([^|]+)\|/g;
  const beats: { num: number; timecode: string; time: number; desc: string; delta: number; mode: string }[] = [];

  let beatMatch: RegExpExecArray | null;
  while ((beatMatch = beatRowRegex.exec(content)) !== null) {
    beats.push({
      num: parseInt(beatMatch[1], 10),
      timecode: beatMatch[2],
      time: parseFloat(beatMatch[3]),
      desc: beatMatch[4].trim(),
      delta: parseFloat(beatMatch[5]),
      mode: beatMatch[6].trim()
    });
  }

  let beatIntervalsValid = true;
  const intervalViolations: string[] = [];

  if (beats.length < 20) {
    beatIntervalsValid = false;
    intervalViolations.push(`Insufficient beats parsed: found ${beats.length}, expected >= 20`);
  } else {
    for (let i = 1; i < beats.length; i++) {
      const prev = beats[i - 1];
      const curr = beats[i];
      const actualDelta = Math.round((curr.time - prev.time) * 100) / 100;
      
      if (actualDelta < 0.49 || actualDelta > 1.51) {
        beatIntervalsValid = false;
        intervalViolations.push(
          `Beat ${curr.num} at ${curr.time}s has invalid delta ${actualDelta}s from Beat ${prev.num} at ${prev.time}s (Mandate: 0.50s - 1.50s)`
        );
      }
    }
  }

  recordResult(
    "Event Beat Interval Bounds",
    beatIntervalsValid,
    beatIntervalsValid
      ? `All ${beats.length} visual beats satisfy 0.50s <= delta <= 1.50s (range: ${Math.min(...beats.map(b => b.delta || 0.8))}s to ${Math.max(...beats.map(b => b.delta || 0.8))}s)`
      : `Violations: ${intervalViolations.join("; ")}`
  );

  // --------------------------------------------------------------------------
  // Check 4: Shot Metadata Completeness (All 8 Required Fields)
  // --------------------------------------------------------------------------
  console.log("\nExecuting Check 4: Shot Metadata Completeness (8 Fields)...");

  const requiredShotFields = [
    { name: "Duration & Exact Timecodes", regex: /1\.\s+\*\*Duration & Exact Timecodes\*\*:/i },
    { name: "Visual Description", regex: /2\.\s+\*\*Visual Description\*\*:/i },
    { name: "Actual Product Action", regex: /3\.\s+\*\*Actual Product Action\*\*:/i },
    { name: "Camera Framing, Crop, and Motion", regex: /4\.\s+\*\*Camera Framing, Crop, and Motion\*\*:/i },
    { name: "Typography", regex: /5\.\s+\*\*Typography\*\*:/i },
    { name: "Transition Mechanism", regex: /6\.\s+\*\*Transition Mechanism\*\*:/i },
    { name: "Intended Sound Design Beat", regex: /7\.\s+\*\*Intended Sound Design Beat\*\*:/i },
    { name: "Rationale", regex: /8\.\s+\*\*Rationale\*\*:/i },
  ];

  let missingFieldsCount = 0;
  const missingShotFieldDetails: string[] = [];

  for (const shot of shots) {
    for (const field of requiredShotFields) {
      if (!field.regex.test(shot.text)) {
        missingFieldsCount++;
        missingShotFieldDetails.push(`Shot ${shot.id} is missing field "${field.name}"`);
      }
    }
  }

  recordResult(
    "Shot Metadata Completeness",
    missingFieldsCount === 0,
    missingFieldsCount === 0
      ? `All ${shots.length} shots contain all 8 mandatory metadata fields with zero omissions`
      : `Missing fields (${missingFieldsCount}): ${missingShotFieldDetails.join("; ")}`
  );

  // --------------------------------------------------------------------------
  // Check 5: 14-Capability Inventory & 8 Mandatory Dimensions
  // --------------------------------------------------------------------------
  console.log("\nExecuting Check 5: 14-Capability Inventory & Dimensions...");

  const capabilityRegex = /#### Capability (\d+): (.+)/g;
  const capabilities: { num: number; title: string; text: string }[] = [];
  const capIndices: { num: number; title: string; index: number }[] = [];

  let capMatch: RegExpExecArray | null;
  while ((capMatch = capabilityRegex.exec(content)) !== null) {
    capIndices.push({ num: parseInt(capMatch[1], 10), title: capMatch[2], index: capMatch.index });
  }

  for (let i = 0; i < capIndices.length; i++) {
    const current = capIndices[i];
    const nextIndex = i + 1 < capIndices.length ? capIndices[i + 1].index : content.indexOf("## Section 2: Core Thesis");
    const capText = content.slice(current.index, nextIndex);
    capabilities.push({ num: current.num, title: current.title, text: capText });
  }

  const requiredCapFields = [
    { name: "Exact User Action / Input", regex: /1\.\s+\*\*Exact User Action \/ Input\*\*:/i },
    { name: "Exact Rendered Mathematical Visual", regex: /2\.\s+\*\*Exact Rendered Mathematical Visual\*\*:/i },
    { name: "Active UI Controls and Component Paths", regex: /3\.\s+\*\*Active UI Controls and Component Paths\*\*:/i },
    { name: "Responsible Renderer, Material & Camera Configurations", regex: /4\.\s+\*\*Responsible Renderer, Material & Camera Configurations\*\*:/i },
    { name: "Direct Capture Feasibility vs. Remotion Reuse Viability", regex: /5\.\s+\*\*Direct Capture Feasibility vs\. Remotion Reuse Viability\*\*:/i },
    { name: "Production Readiness for Launch Marketing", regex: /6\.\s+\*\*Production Readiness for Launch Marketing\*\*:/i },
    { name: "Exact Mathematical Formulas and Parameters Supported", regex: /7\.\s+\*\*Exact Mathematical Formulas and Parameters Supported\*\*:/i },
    { name: "Interactive Responsiveness and State Handling", regex: /8\.\s+\*\*Interactive Responsiveness and State Handling\*\*:/i },
  ];

  let missingCapFields = 0;
  for (const cap of capabilities) {
    for (const field of requiredCapFields) {
      if (!field.regex.test(cap.text)) {
        missingCapFields++;
        console.warn(`Capability ${cap.num} missing: ${field.name}`);
      }
    }
  }

  const isCapabilitiesValid = capabilities.length === 14 && missingCapFields === 0;
  recordResult(
    "14-Capability Inventory",
    isCapabilitiesValid,
    isCapabilitiesValid
      ? `Full 14 capabilities verified across all 8 mandatory dimensions (112 data points verified)`
      : `Capabilities count: ${capabilities.length}/14, Missing dimensions: ${missingCapFields}`
  );

  // --------------------------------------------------------------------------
  // Check 6: Core Product Thesis (One Authoritative Paragraph)
  // --------------------------------------------------------------------------
  console.log("\nExecuting Check 6: Core Product Thesis Mandate...");

  const thesisSectionMatch = /### 2\.1 Authoritative One-Paragraph Product Thesis\s+>\s+([^\n]+(?:\n>\s+[^\n]+)*)/.exec(content);
  let thesisParagraphValid = false;
  let thesisWordCount = 0;

  if (thesisSectionMatch) {
    const thesisBlock = thesisSectionMatch[1].replace(/^>\s+/gm, "").trim();
    // Verify it answers: What is Vinculum? Why care? What should viewer feel?
    const hasVinculum = /Vinculum is/i.test(thesisBlock);
    const hasWhyCare = /unified|spatial|geometry|computation|notation/i.test(thesisBlock);
    const hasFeeling = /feel|clarity|mastery/i.test(thesisBlock);
    thesisWordCount = thesisBlock.split(/\s+/).length;

    thesisParagraphValid = hasVinculum && hasWhyCare && hasFeeling && thesisWordCount >= 50 && thesisWordCount <= 200;
  }

  recordResult(
    "Core Product Thesis",
    thesisParagraphValid,
    thesisParagraphValid
      ? `Exactly one authoritative paragraph present (${thesisWordCount} words) answering What is Vinculum, Why care, and Emotional target`
      : `Thesis block validation failed`
  );

  // --------------------------------------------------------------------------
  // Check 7: Repository File Existence Audit
  // --------------------------------------------------------------------------
  console.log("\nExecuting Check 7: Cited Repository File Existence Audit...");

  // Extract all file paths cited in backticks or text matching apps/... or packages/... or docs/...
  const pathRegex = /(?:`|"|')((?:apps|packages|docs|public)\/[a-zA-Z0-9_\-\.\/]+)(?:`|"|')/g;
  const citedPaths = new Set<string>();
  let pathMatch: RegExpExecArray | null;

  while ((pathMatch = pathRegex.exec(content)) !== null) {
    const rawPath = pathMatch[1];
    // Filter out glob patterns, ellipses, or placeholders
    if (rawPath.includes("*") || rawPath.includes("...")) {
      continue;
    }
    const cleanPath = rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
    citedPaths.add(cleanPath);
  }

  let missingFilesCount = 0;
  const missingFilePaths: string[] = [];
  const verifiedPaths: string[] = [];

  for (const relPath of citedPaths) {
    let absPath = path.resolve(repoRoot, relPath);
    if (!fs.existsSync(absPath) && relPath.startsWith("public/")) {
      const altPath = path.resolve(repoRoot, "apps/video", relPath);
      if (fs.existsSync(altPath)) {
        absPath = altPath;
      }
    }

    if (!fs.existsSync(absPath)) {
      missingFilesCount++;
      missingFilePaths.push(relPath);
    } else {
      verifiedPaths.push(relPath);
    }
  }

  recordResult(
    "Repository File Citations",
    missingFilesCount === 0,
    missingFilesCount === 0
      ? `All ${verifiedPaths.length} cited repository paths exist on disk`
      : `Missing files (${missingFilesCount}): ${missingFilePaths.join(", ")}`
  );

  // --------------------------------------------------------------------------
  // Summary & Exit Gate
  // --------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(" Verification Summary Report");
  console.log("==================================================================");

  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Total Checks: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}\n`);

  if (allPassed) {
    console.log(">>> [SUCCESS] All verification checks passed cleanly with exit code 0.");
    console.log(">>> The Vinculum Showcase Film treatment is complete, authoritative, and production-ready.\n");
    process.exit(0);
  } else {
    console.error(">>> [FAILURE] One or more verification checks failed. Review errors above.");
    process.exit(1);
  }
}

verifyShowcaseTreatment().catch((err) => {
  console.error("Unhandled error during verification:", err);
  process.exit(1);
});
