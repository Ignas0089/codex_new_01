/**
 * Shared domain types for the internal newsletter generator pipeline.
 * These interfaces model the raw inputs collected from the UI,
 * intermediate AI generated artifacts, and the structured newsletter
 * sections returned to the client for review.
 */

export const MAX_AUDIO_DURATION_SECONDS = 60 * 60; // 60 minutes
export const SUPPORTED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/wav"] as const;

export type AudioMimeType = (typeof SUPPORTED_AUDIO_MIME_TYPES)[number];

export interface MeetingAudioUpload {
  filename: string;
  mimeType: AudioMimeType;
  /** Duration in seconds as provided by the client-side metadata. */
  durationSeconds: number;
  /** Raw byte size of the upload (used for guard rails and logging). */
  sizeBytes: number;
  /** Optional URL when the file is already persisted (e.g., cloud storage). */
  url?: string;
}

export interface MeetingRecapInput {
  text: string;
  author?: string;
  submittedAt?: string; // ISO string
}

export interface MeetingTranscriptInput {
  text: string;
  source?: string;
  submittedAt?: string; // ISO string
}

export interface FreeformTopicPrompt {
  /** Short topic title selected by the user (e.g., "Team Wins"). */
  topic: string;
  /** Optional extra instructions for tone or details. */
  instructions?: string;
}

export interface FreeformTopicSuggestion {
  prompt?: FreeformTopicPrompt;
  title: string;
  body: string;
  /** Confidence score returned by the model (0-1 scale). */
  confidence?: number;
  toneGuidance?: string;
  /** Whether the suggestion still matches the prompt after edits. */
  isPromptAligned?: boolean;
}

export interface ActionItem {
  id: string;
  summary: string;
  owner?: string;
  dueDate?: string; // ISO string
  status?: "pending" | "in_progress" | "completed";
}

export interface NewsletterSection {
  id: string;
  title: string;
  /** The section body, pre-formatted as Markdown-compatible text. */
  body: string;
  /** Optional highlights extracted from the underlying sources. */
  highlights?: string[];
}

export interface StructuredNewsletter {
  introduction: NewsletterSection;
  mainUpdates: NewsletterSection[];
  actionItems: ActionItem[];
  closing: NewsletterSection;
  freeformTopic: FreeformTopicSuggestion;
}

export interface NewsletterGenerationRequest {
  audio?: MeetingAudioUpload;
  meetingRecap: MeetingRecapInput;
  transcript: MeetingTranscriptInput;
  freeformTopicPrompt?: FreeformTopicPrompt;
}

export interface NewsletterGenerationResponse {
  sections: StructuredNewsletter;
  metadata: {
    createdAt: string; // ISO string
    processingTimeMs?: number;
    tokensConsumed?: number;
    audioSummaryIncluded: boolean;
  };
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?:
    | "REQUIRED"
    | "INVALID_FORMAT"
    | "UNSUPPORTED_TYPE"
    | "LIMIT_EXCEEDED"
    | "INVALID_LENGTH";
}

export interface NewsletterValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
}

export interface NewsletterUploadPayload
  extends Pick<NewsletterGenerationRequest, "audio" | "meetingRecap" | "transcript" | "freeformTopicPrompt"> {}

