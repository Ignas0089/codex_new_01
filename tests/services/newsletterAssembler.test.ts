import { assembleNewsletter } from "../../src/services/newsletterAssembler";
import {
  type ActionItem,
  type AudioHighlightsSummary,
  type NewsletterGenerationRequest,
  type TranscriptSynthesisResult,
} from "../../src/types/newsletter";

describe("assembleNewsletter", () => {
  const createRequest = (
    overrides: Partial<NewsletterGenerationRequest> = {},
  ): NewsletterGenerationRequest => ({
    audio: {
      filename: "meeting.mp3",
      mimeType: "audio/mpeg",
      durationSeconds: 1800,
      sizeBytes: 1024,
    },
    meetingRecap: {
      text: "Sprint 12 retrospective recap",
    },
    transcript: {
      text: "Transcript content",
    },
    freeformTopicPrompt: {
      topic: "Team Wins",
      instructions: "Highlight shout-outs",
    },
    ...overrides,
  });

  const createTranscriptSynthesis = (
    overrides: Partial<TranscriptSynthesisResult> = {},
  ): TranscriptSynthesisResult => ({
    summary: "We completed the migration and planned next steps.",
    decisions: [
      {
        id: "d1",
        summary: "Ship the new onboarding flow",
        rationale: "Unblocks beta launch",
        source: "recap",
      },
    ],
    insights: [
      {
        id: "i1",
        summary: "User feedback is positive",
        quote: "Love the faster sign-up!",
        source: "both",
      },
    ],
    actionItems: [
      {
        id: "a1",
        summary: "Prepare release notes",
        owner: "Jamie",
        dueDate: "2024-05-01T00:00:00.000Z",
      },
    ],
    metadata: {
      usedRecap: true,
      usedTranscript: true,
      combinedCharacterCount: 1200,
    },
    ...overrides,
  });

  const createAudioSummary = (
    overrides: Partial<AudioHighlightsSummary> = {},
  ): AudioHighlightsSummary => ({
    transcript: "audio transcript",
    durationSeconds: 1800,
    source: {
      filename: "meeting.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 1024,
    },
    highlights: [
      {
        id: "h1",
        summary: "Progress discussed",
        startTimeSeconds: 30,
      },
    ],
    ...overrides,
  });

  it("returns ordered sections with metadata when dependencies succeed", async () => {
    const request = createRequest();
    const audioSummary = createAudioSummary();
    const transcriptResult = createTranscriptSynthesis();
    const generateId = jest.fn(() => `sec-${generateId.mock.calls.length + 1}`);
    const now = jest.fn(() => new Date("2024-03-01T12:00:00.000Z"));

    const dateNowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_250);

    const response = await assembleNewsletter({
      request,
      audioData: new Uint8Array([1, 2, 3]),
      dependencies: {
        summarizeAudio: jest.fn(async () => audioSummary),
        synthesizeContent: jest.fn(async () => transcriptResult),
        generateId,
        now,
      },
    });

    expect(response.sections.introduction.title).toBe("Introduction");
    expect(response.sections.mainUpdates.map((section) => section.title)).toEqual([
      "Key Decisions",
      "Highlights & Insights",
    ]);
    expect(response.sections.actionItems.items).toHaveLength(1);
    expect(response.sections.closing.title).toBe("Closing");
    expect(response.sections.freeformTopic.title).toBe("Team Wins");

    expect(response.metadata).toEqual({
      createdAt: "2024-03-01T12:00:00.000Z",
      processingTimeMs: 250,
      audioSummaryIncluded: true,
    });

    expect(generateId).toHaveBeenCalled();
    expect(dateNowSpy).toHaveBeenCalledTimes(2);

    dateNowSpy.mockRestore();
  });

  it("falls back to default copy when transcript data is sparse", async () => {
    const request = createRequest({
      audio: undefined,
      freeformTopicPrompt: undefined,
    });
    const transcriptResult = createTranscriptSynthesis({
      summary: "",
      decisions: [],
      insights: [],
      actionItems: [],
    });

    const response = await assembleNewsletter({
      request,
      dependencies: {
        synthesizeContent: jest.fn(async () => transcriptResult),
      },
    });

    expect(response.sections.introduction.body).toContain("This week's update covers");
    expect(response.sections.mainUpdates).toHaveLength(1);
    expect(response.sections.mainUpdates[0]).toMatchObject({
      title: "Main Updates",
    });
    expect(response.sections.actionItems.body).toContain("No action items were captured");
    expect(response.sections.closing.body).toContain("Thanks for reading");
    expect(response.sections.freeformTopic.title).toBe("Additional Topic");
    expect(response.metadata.audioSummaryIncluded).toBe(false);
  });

  it("handles partial action item details and audio warnings", async () => {
    const transcriptResult = createTranscriptSynthesis({
      actionItems: [
        { id: "a1", summary: "   ", owner: "", dueDate: "invalid" },
        { id: "a2", summary: "Schedule follow-up" },
      ] as ActionItem[],
    });

    const response = await assembleNewsletter({
      request: createRequest(),
      dependencies: {
        synthesizeContent: jest.fn(async () => transcriptResult),
        summarizeAudio: jest.fn(async () =>
          createAudioSummary({
            warnings: ["Audio truncated"],
            highlights: [],
          }),
        ),
      },
    });

    expect(response.sections.actionItems.body).toContain("Follow up item 1");
    expect(response.sections.actionItems.body).toContain("Schedule follow-up");
    expect(response.sections.closing.body).toContain("Note: Audio truncated");
  });
});
