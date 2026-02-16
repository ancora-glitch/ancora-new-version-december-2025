import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FORBIDDEN_PATTERNS = [
  { pattern: /getClaims\s*\(/, label: "getClaims(" },
  { pattern: /supabase\.auth\.getClaims/, label: "supabase.auth.getClaims" },
  { pattern: /\bwindow\./, label: "window.* (not available in edge runtime)" },
  { pattern: /\bdocument\./, label: "document.* (not available in edge runtime)" },
  { pattern: /\blocalStorage[\.\[]/, label: "localStorage (not available in edge runtime)" },
];

function collectEdgeFunctionFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectEdgeFunctionFiles(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

describe("Edge function forbidden pattern guard", () => {
  const files = collectEdgeFunctionFiles("supabase/functions");

  it("should find edge function files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("should not contain forbidden API patterns", () => {
    const violations: string[] = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf-8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          if (pattern.test(lines[i])) {
            violations.push(`${file}:${i + 1} — ${label}`);
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Forbidden patterns found in edge functions:\n${violations.join("\n")}`
      );
    }
  });
});
