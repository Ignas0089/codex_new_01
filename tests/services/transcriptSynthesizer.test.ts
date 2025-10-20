import {
  synthesizeMeetingContent,
  TranscriptSynthesizerErrorCode,
  type TranscriptSynthesizerDependencies,
} from "../../src/services/transcriptSynthesizer";
import {
  type MeetingRecapInput,
  type MeetingTranscriptInput,
  type SynthesizedDecision,
  type SynthesizedInsight,
} from "../../src/types/newsletter";

describe("synthesizeMeetingContent", () => {
  const recap: MeetingRecapInput = {
    text: "  Recap focused on launch readiness.  ",
  };

  const transcript: MeetingTranscriptInput = {
    text: "  Transcript captured detailed engineering updates.  ",
  };

  const createDependencies = (
    overrides: Partial<TranscriptSynthesizerDependencies> = {},
  ): TranscriptSynthesizerDependencies => ({
    summarize: jest.fn(async () => "  Combined summary of recap and transcript.  "),
    extractDecisions: jest.fn(async () => [
      {
        id: "",
        summary: "  Approve beta launch in Q3.  ",
        rationale: "  Market alignment.  ",
        source: "recap",
      } as SynthesizedDecision,
    ]),
    extractActionItems: jest.fn(async () => [
      {
        id: "",
        summary: "  Prepare beta release checklist.  ",
        owner: "  Casey  ",
        dueDate: "2024-06-01",
        source: "transcript",
      },
      {
        id: "should-be-filtered",
        summary: "   ",
      },
    ]),
    extractInsights: jest.fn(async () => [
      {
        id: "",
        summary: "  Customers expect faster onboarding.  ",
        quote: "  \"We need shorter setup time.\"  ",
      } as SynthesizedInsight,
      {
        id: "skip",
        summary: "",
      },
    ]),
    ...overrides,
  });

  it("returns normalized synthesis data from recap and transcript", async () => {
    const dependencies = createDependencies();

    const result = await synthesizeMeetingContent({
      meetingRecap: recap,
      transcript,
      dependencies,
      options: { summaryMaxLength: 5000 },
    });

    expect(dependencies.summarize).toHaveBeenCalledWith(
      expect.objectContaining({
        combinedText: expect.stringContaining("Recap focused"),
        maxLength: 5000,
      }),
    );
    expect(result.summary).toBe("Combined summary of recap and transcript.");
    expect(result.decisions).toEqual([
      expect.objectContaining({
        id: "decision-1",
        summary: "Approve beta launch in Q3.",
        rationale: "Market alignment.",
        source: "recap",
      }),
    ]);
    expect(result.actionItems).toEqual([
      expect.objectContaining({
        id: "action-1",
        summary: "Prepare beta release checklist.",
        owner: "Casey",
        dueDate: "2024-06-01",
        source: "transcript",
      }),
    ]);
    expect(result.insights).toEqual([
      expect.objectContaining({
        id: "insight-1",
        summary: "Customers expect faster onboarding.",
        quote: '"We need shorter setup time."',
        source: "both",
      }),
    ]);
    expect(result.metadata).toMatchObject({
      usedRecap: true,
      usedTranscript: true,
      truncatedInput: undefined,
    });
  });

  it("adds a truncation warning when combined text exceeds the limit", async () => {
    const longRecap: MeetingRecapInput = {
      text: "recap".repeat(6000),
    };
    const dependencies = createDependencies();

    const result = await synthesizeMeetingContent({
      meetingRecap: longRecap,
      transcript,
      dependencies,
    });

    expect(result.metadata.warnings?.[0]).toContain("was truncated");
    expect(result.metadata.truncatedInput).toBe(true);
    expect(dependencies.summarize).toHaveBeenCalledWith(
      expect.objectContaining({
        combinedText: expect.any(String),
        maxLength: expect.any(Number),
      }),
    );
  });

  it("throws when neither recap nor transcript are provided", async () => {
    const dependencies = createDependencies();

    await expect(
      synthesizeMeetingContent({
        dependencies,
      }),
    ).rejects.toMatchObject({ code: TranscriptSynthesizerErrorCode.NO_CONTENT_PROVIDED });
  });

  it("wraps dependency failures in domain errors", async () => {
    const dependencies = createDependencies({
      summarize: jest.fn(async () => {
        throw new Error("model offline");
      }),
    });

    await expect(
      synthesizeMeetingContent({
        meetingRecap: recap,
        dependencies,
      }),
    ).rejects.toMatchObject({
      code: TranscriptSynthesizerErrorCode.SUMMARY_FAILED,
    });
  });
});
