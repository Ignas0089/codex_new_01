import {
  createFreeformTopicGenerator,
  type DraftFreeformTopicInput,
} from "../../src/services/freeformTopicGenerator";

describe("freeformTopicGenerator", () => {

  it("sanitizes prompt/context and clamps body length", async () => {
    const draftCopy = jest.fn(async (input: DraftFreeformTopicInput) => {
      expect(input.prompt).toEqual({
        topic: "Team Wins",
        instructions: "Celebrate the biggest shout outs",
      });
      expect(input.context).toMatchObject({
        summary: "We shipped the new feature.",
        tone: expect.any(String),
        maxBodyLength: 280,
        decisions: [{ id: "d1", summary: "Launch the beta" }],
        insights: [{ id: "i1", summary: "Customers love the speed" }],
        actionItems: [{ id: "a1", summary: "Prepare release", owner: "Casey" }],
        audioHighlights: [{ id: "h1", summary: "Performance wins" }],
      });

      return {
        title: "  Team Wins Spotlight  ",
        body: "Celebrate the incredible progress this week by highlighting team shout-outs, milestones, and next steps.".repeat(
          5,
        ),
        toneGuidance: "  Keep upbeat and appreciative.  ",
        confidence: 0.92,
      };
    });

    const generate = createFreeformTopicGenerator({
      dependencies: { draftCopy },
      options: { maxBodyLength: 280, defaultToneGuidance: "Friendly and appreciative." },
    });

    const suggestion = await generate({
      prompt: {
        topic: "  Team Wins  ",
        instructions: " Celebrate the biggest shout outs ",
      },
      context: {
        summary: " We shipped the new feature. ",
        decisions: [
          { id: "d1", summary: " Launch the beta ", source: "both" },
          { id: "d2", summary: "  " },
        ],
        insights: [
          { id: "i1", summary: " Customers love the speed ", source: "recap" },
        ],
        actionItems: [
          { id: "a1", summary: " Prepare release ", owner: " Casey " },
          { id: "a2", summary: "   " },
        ],
        audioHighlights: [
          { id: "h1", summary: " Performance wins " },
          { id: "h2", summary: "   " },
        ],
      },
    });

    expect(suggestion).toMatchObject({
      title: "Team Wins Spotlight",
      toneGuidance: "Keep upbeat and appreciative.",
      confidence: 0.92,
      isPromptAligned: true,
    });
    expect(suggestion.body.length).toBeLessThanOrEqual(280);
    expect(suggestion.body.endsWith("…")).toBe(true);
  });

  it("falls back to defaults when the draft copy throws", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const draftCopy = jest.fn(async () => {
      throw new Error("model failure");
    });

    const generate = createFreeformTopicGenerator({
      dependencies: { draftCopy },
    });

    const suggestion = await generate({
      prompt: { topic: "Announcements", instructions: "Share leadership notes" },
    });

    expect(suggestion).toEqual({
      prompt: { topic: "Announcements", instructions: "Share leadership notes" },
      title: "Announcements",
      body:
        "Use this space to add any announcements or highlights that didn't fit into the main sections. Update the copy as needed before sharing.",
      toneGuidance:
        "Friendly internal tone: highlight wins, appreciate contributors, and reinforce next steps.",
      isPromptAligned: true,
    });

    warnSpy.mockRestore();
  });

  it("omits prompt metadata when inputs are blank", async () => {
    const draftCopy = jest.fn(async (input: DraftFreeformTopicInput) => {
      expect(input.prompt).toBeUndefined();
      expect(input.context.decisions).toHaveLength(0);
      expect(input.context.maxBodyLength).toBe(1500);
      return { body: "Add optional shout-outs." };
    });

    const generate = createFreeformTopicGenerator({
      dependencies: { draftCopy },
    });

    const suggestion = await generate({
      prompt: { topic: "   ", instructions: "   " },
      context: {},
    });

    expect(suggestion.prompt).toBeUndefined();
    expect(suggestion.title).toBe("Additional Topic");
    expect(suggestion.body).toBe("Add optional shout-outs.");
    expect(suggestion.isPromptAligned).toBe(false);
  });
});
