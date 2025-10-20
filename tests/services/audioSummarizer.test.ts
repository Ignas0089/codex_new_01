import {
  summarizeMeetingAudio,
  AudioSummarizerErrorCode,
  type AudioSummarizerDependencies,
} from "../../src/services/audioSummarizer";
import { type MeetingAudioUpload } from "../../src/types/newsletter";

const createAudio = (overrides: Partial<MeetingAudioUpload> = {}): MeetingAudioUpload => ({
  filename: "recap.mp3",
  mimeType: "audio/mpeg",
  durationSeconds: 120,
  sizeBytes: 1024 * 1024,
  ...overrides,
});

describe("summarizeMeetingAudio", () => {
  const createDependencies = (
    overrides: Partial<AudioSummarizerDependencies> = {},
  ): AudioSummarizerDependencies => ({
    transcribeAudio: jest.fn(async () => "Key updates from the meeting."),
    generateHighlights: jest.fn(async () => [
      {
        id: "h1",
        summary: "We achieved milestone Alpha.",
        startTimeSeconds: 15,
        endTimeSeconds: 45,
      },
      {
        id: "h2",
        summary: "Next sprint focuses on Beta launch.",
        startTimeSeconds: 60,
        endTimeSeconds: 90,
      },
    ]),
    ...overrides,
  });

  it("returns highlights and transcript metadata when dependencies succeed", async () => {
    const audio = createAudio();
    const dependencies = createDependencies();
    const audioData = new Uint8Array([1, 2, 3]);

    const result = await summarizeMeetingAudio({
      audio,
      audioData,
      dependencies,
      options: { maxHighlights: 2 },
    });

    expect(dependencies.transcribeAudio).toHaveBeenCalledWith({ audio, audioData });
    expect(dependencies.generateHighlights).toHaveBeenCalledWith({
      transcript: "Key updates from the meeting.",
      durationSeconds: audio.durationSeconds,
      maxHighlights: 2,
    });
    expect(result.highlights).toHaveLength(2);
    expect(result.transcript).toBe("Key updates from the meeting.");
    expect(result.source).toMatchObject({ filename: audio.filename, mimeType: audio.mimeType });
    expect(result.warnings).toBeUndefined();
  });

  it("truncates highlights when generator exceeds the configured limit", async () => {
    const audio = createAudio();
    const dependencies = createDependencies({
      generateHighlights: jest.fn(async () => [
        { id: "1", summary: "A" },
        { id: "2", summary: "B" },
        { id: "3", summary: "C" },
      ]),
    });

    const result = await summarizeMeetingAudio({
      audio,
      dependencies,
      options: { maxHighlights: 2 },
    });

    expect(result.highlights).toHaveLength(2);
    expect(result.warnings?.[0]).toContain("Results were truncated");
  });

  it("throws when the audio transcript is empty", async () => {
    const audio = createAudio();
    const dependencies = createDependencies({
      transcribeAudio: jest.fn(async () => "   "),
    });

    await expect(
      summarizeMeetingAudio({
        audio,
        dependencies,
      }),
    ).rejects.toMatchObject({ code: AudioSummarizerErrorCode.EMPTY_TRANSCRIPT });
  });

  it("throws when audio metadata exceeds guard rails", async () => {
    const audio = createAudio({ durationSeconds: 60 * 60 + 1 });
    const dependencies = createDependencies();

    await expect(
      summarizeMeetingAudio({
        audio,
        dependencies,
      }),
    ).rejects.toMatchObject({ code: AudioSummarizerErrorCode.AUDIO_LIMIT_EXCEEDED });
  });

  it("wraps highlight generation failures in a domain error", async () => {
    const audio = createAudio();
    const dependencies = createDependencies({
      generateHighlights: jest.fn(async () => {
        throw new Error("model offline");
      }),
    });

    await expect(
      summarizeMeetingAudio({
        audio,
        dependencies,
      }),
    ).rejects.toMatchObject({
      code: AudioSummarizerErrorCode.HIGHLIGHT_GENERATION_FAILED,
    });
  });
});

