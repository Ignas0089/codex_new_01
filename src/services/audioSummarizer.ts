import {
  AudioHighlight,
  AudioHighlightsSummary,
  MAX_AUDIO_DURATION_SECONDS,
  MeetingAudioUpload,
} from "../types/newsletter";

const MAX_AUDIO_FILE_SIZE_BYTES = 200 * 1024 * 1024; // Mirror upload guard rail
const DEFAULT_MAX_HIGHLIGHTS = 5;
const MAX_HIGHLIGHTS_LIMIT = 10;

export enum AudioSummarizerErrorCode {
  AUDIO_NOT_PROVIDED = "AUDIO_NOT_PROVIDED",
  AUDIO_LIMIT_EXCEEDED = "AUDIO_LIMIT_EXCEEDED",
  INVALID_AUDIO_METADATA = "INVALID_AUDIO_METADATA",
  TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED",
  EMPTY_TRANSCRIPT = "EMPTY_TRANSCRIPT",
  HIGHLIGHT_GENERATION_FAILED = "HIGHLIGHT_GENERATION_FAILED",
}

export class AudioSummarizerError extends Error {
  public readonly code: AudioSummarizerErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(code: AudioSummarizerErrorCode, message: string, metadata?: Record<string, unknown>, cause?: unknown) {
    super(message);
    this.name = "AudioSummarizerError";
    this.code = code;
    this.metadata = metadata;

    if (cause !== undefined) {
      (this as unknown as { cause?: unknown }).cause = cause;
    }
  }
}

export interface SummarizerTranscriptionInput {
  audio: MeetingAudioUpload;
  audioData?: Uint8Array;
}

export interface SummarizerHighlightInput {
  transcript: string;
  durationSeconds: number;
  maxHighlights: number;
}

export interface AudioSummarizerDependencies {
  transcribeAudio: (input: SummarizerTranscriptionInput) => Promise<string>;
  generateHighlights: (input: SummarizerHighlightInput) => Promise<AudioHighlight[]>;
}

export interface SummarizeMeetingAudioOptions {
  /** Desired maximum number of highlights in the response. */
  maxHighlights?: number;
}

export interface SummarizeMeetingAudioParams {
  audio?: MeetingAudioUpload;
  audioData?: Uint8Array;
  dependencies: AudioSummarizerDependencies;
  options?: SummarizeMeetingAudioOptions;
}

export const summarizeMeetingAudio = async ({
  audio,
  audioData,
  dependencies,
  options,
}: SummarizeMeetingAudioParams): Promise<AudioHighlightsSummary> => {
  if (!audio) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.AUDIO_NOT_PROVIDED,
      "Meeting audio is required to generate highlights.",
    );
  }

  if (audio.durationSeconds <= 0) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.INVALID_AUDIO_METADATA,
      "Audio duration must be greater than zero seconds.",
      { durationSeconds: audio.durationSeconds },
    );
  }

  if (audio.durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.AUDIO_LIMIT_EXCEEDED,
      "Audio duration exceeds the supported 60 minute limit.",
      { durationSeconds: audio.durationSeconds },
    );
  }

  if (audio.sizeBytes > MAX_AUDIO_FILE_SIZE_BYTES) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.AUDIO_LIMIT_EXCEEDED,
      "Audio file size exceeds the supported 200MB limit.",
      { sizeBytes: audio.sizeBytes },
    );
  }

  const maxHighlights = normalizeMaxHighlights(options?.maxHighlights);

  let transcript: string;
  try {
    transcript = await dependencies.transcribeAudio({ audio, audioData });
  } catch (error) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.TRANSCRIPTION_FAILED,
      "Failed to transcribe meeting audio.",
      { filename: audio.filename },
      error,
    );
  }

  const normalizedTranscript = transcript?.trim();
  if (!normalizedTranscript) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.EMPTY_TRANSCRIPT,
      "Transcription result was empty.",
      { filename: audio.filename },
    );
  }

  let highlights: AudioHighlight[];
  try {
    highlights = await dependencies.generateHighlights({
      transcript: normalizedTranscript,
      durationSeconds: audio.durationSeconds,
      maxHighlights,
    });
  } catch (error) {
    throw new AudioSummarizerError(
      AudioSummarizerErrorCode.HIGHLIGHT_GENERATION_FAILED,
      "Failed to generate highlights from the audio transcript.",
      { filename: audio.filename },
      error,
    );
  }

  const normalizedHighlights = Array.isArray(highlights) ? highlights : [];
  const warnings: string[] = [];

  let limitedHighlights = normalizedHighlights;
  if (normalizedHighlights.length > maxHighlights) {
    limitedHighlights = normalizedHighlights.slice(0, maxHighlights);
    warnings.push(
      `Returned highlight count (${normalizedHighlights.length}) exceeded the configured maximum (${maxHighlights}). Results were truncated.`,
    );
  }

  return {
    transcript: normalizedTranscript,
    highlights: limitedHighlights,
    durationSeconds: audio.durationSeconds,
    source: {
      filename: audio.filename,
      mimeType: audio.mimeType,
      sizeBytes: audio.sizeBytes,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

const normalizeMaxHighlights = (value: number | undefined): number => {
  if (!value || value <= 0 || !Number.isFinite(value)) {
    return DEFAULT_MAX_HIGHLIGHTS;
  }

  const rounded = Math.round(value);
  if (rounded <= 0) {
    return DEFAULT_MAX_HIGHLIGHTS;
  }

  return Math.min(rounded, MAX_HIGHLIGHTS_LIMIT);
};

