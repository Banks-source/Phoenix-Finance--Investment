import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateReviewMarkdown } from "./quarterlyReview";

describe("generateReviewMarkdown", () => {
  it("includes the date, elapsed time, hard rules, cycle inputs, kill criteria, and actions", () => {
    const md = generateReviewMarkdown(
      {
        startedAt: "2026-09-06T01:00:00Z",
        elapsedSeconds: 900,
        cycleInputsNotes: "BTC well above 200w MA",
        killCriteria: [{ text: "Example criterion", status: "no", note: "" }],
        actionsNotes: "No changes needed this quarter",
      },
      [{ rule: 1, name: "No co-invested illiquid deals", status: "pass" }]
    );
    expect(md).toContain("2026-09-06");
    expect(md).toContain("15 min");
    expect(md).toContain("Rule 1 (No co-invested illiquid deals): **pass**");
    expect(md).toContain("BTC well above 200w MA");
    expect(md).toContain("Example criterion");
    expect(md).toContain("No changes needed this quarter");
  });

  it("shows placeholders when notes/actions are empty", () => {
    const md = generateReviewMarkdown(
      { startedAt: "2026-09-06T01:00:00Z", elapsedSeconds: null, cycleInputsNotes: null, killCriteria: [], actionsNotes: null },
      []
    );
    expect(md).toContain("_(none recorded)_");
    expect(md).toContain("Elapsed: —");
  });

  it("marks a kill criterion answered 'yes' with a checked box", () => {
    const md = generateReviewMarkdown(
      {
        startedAt: "2026-09-06T01:00:00Z",
        elapsedSeconds: 60,
        cycleInputsNotes: "",
        killCriteria: [{ text: "Something triggered", status: "yes", note: "flagged for advisor" }],
        actionsNotes: "",
      },
      []
    );
    expect(md).toContain("- [x] Something triggered — yes (flagged for advisor)");
  });
});
