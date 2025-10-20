/**
 * Shared domain types for the internal newsletter generator pipeline.
 * These interfaces model the raw inputs collected from the UI,
 * intermediate AI generated artifacts, and the structured newsletter
 * sections returned to the client for review.
 */

export const MAX_AUDIO_DURATION_SECONDS = 60 * 60; // 60 minutes
export const SUPPORTED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/wav"] as const;

export type AudioMimeType = (typeof SUPPORTED_AUDIO_MIME_TYPES)[number];

export interface AudioHighlight {
  id: string;
  summary: string;
  /** Optional start timestamp in seconds for the highlight clip. */
  startTimeSeconds?: number;
  /** Optional end timestamp in seconds for the highlight clip. */
  endTimeSeconds?: number;
  /** Model-provided confidence between 0-1. */
  confidence?: number;
  /** Optional tags or topics associated with the highlight. */
  topics?: string[];
}

export interface AudioHighlightsSummary {
  transcript: string;
  highlights: AudioHighlight[];
  durationSeconds: number;
  /** Metadata about the processed audio source. */
  source: Pick<MeetingAudioUpload, "filename" | "mimeType" | "sizeBytes">;
  /** Any non-fatal issues encountered while summarizing. */
  warnings?: string[];
}

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
  source?: SynthesizedContentSource;
}

export type SynthesizedContentSource = "recap" | "transcript" | "both";

export interface SynthesizedDecision {
  id: string;
  summary: string;
  source: SynthesizedContentSource;
  rationale?: string;
  confidence?: number;
  supportingEvidence?: string;
}

export interface SynthesizedInsight {
  id: string;
  summary: string;
  source: SynthesizedContentSource;
  quote?: string;
  category?: string;
}

export interface TranscriptSynthesisMetadata {
  usedRecap: boolean;
  usedTranscript: boolean;
  combinedCharacterCount: number;
  truncatedInput?: boolean;
  warnings?: string[];
}

export interface TranscriptSynthesisResult {
  summary: string;
  decisions: SynthesizedDecision[];
  actionItems: ActionItem[];
  insights: SynthesizedInsight[];
  metadata: TranscriptSynthesisMetadata;
}

export interface NewsletterSection {
  id: string;
  title: string;
  /** The section body, pre-formatted as Markdown-compatible text. */
  body: string;
  /** Optional highlights extracted from the underlying sources. */
  highlights?: string[];
}

export interface ActionItemsSection extends NewsletterSection {
  items: ActionItem[];
}

export interface StructuredNewsletter {
  introduction: NewsletterSection;
  mainUpdates: NewsletterSection[];
  actionItems: ActionItemsSection;
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
  warnings?: string[];
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

