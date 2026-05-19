import { describe, expect, it } from "vitest";
import type { AdminRule } from "@/lib/types";

function formatRulesForPrompt(rules: AdminRule[]): string {
  const active = rules.filter((r) => r.active);
  if (active.length === 0) return "";
  const lines = active.map(
    (r, i) =>
      `${i + 1}. [${r.category ?? "general"}] ${r.title}: ${r.body}`
  );
  return `Clinic admin rules (follow these in addition to built-in safety):\n${lines.join("\n")}`;
}

describe("formatActiveRulesForPrompt", () => {
  it("includes only active rules in order", () => {
    const rules: AdminRule[] = [
      {
        id: "1",
        title: "SOAP",
        body: "No PDF for others",
        category: "policy",
        active: true,
        sort_order: 1,
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        title: "Off",
        body: "ignored",
        category: null,
        active: false,
        sort_order: 2,
        created_at: "",
        updated_at: "",
      },
    ];
    const block = formatRulesForPrompt(rules);
    expect(block).toContain("SOAP");
    expect(block).not.toContain("Off");
  });
});
