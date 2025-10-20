import {
  MAX_AUDIO_DURATION_SECONDS,
  MeetingAudioUpload,
  NewsletterUploadPayload,
  NewsletterValidationResult,
  SUPPORTED_AUDIO_MIME_TYPES,
  ValidationErrorDetail,
} from "../../types/newsletter";

const MAX_AUDIO_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB safeguard
const MAX_RECAP_LENGTH = 4000; // characters
const MAX_TRANSCRIPT_LENGTH = 200_000; // characters
const MAX_FREEFORM_TOPIC_LENGTH = 200; // characters
const MAX_FREEFORM_INSTRUCTIONS_LENGTH = 500; // characters

const AUDIO_FILE_NAME_PATTERN = /\.(mp3|wav)$/i;

export interface ParsedUploadBody {
  meetingRecapText?: string;
  transcriptText?: string;
  freeformTopic?: string;
  freeformInstructions?: string;
  audioDurationSeconds?: number;
}

export interface UploadedFileDescriptor {
  mimetype: string;
  originalname: string;
  size: number;
  buffer?: Uint8Array;
}

export interface NewsletterUploadValidationContext {
  audioFile?: UploadedFileDescriptor;
  body: ParsedUploadBody;
}

const buildError = (
  field: string,
  message: string,
  code?: ValidationErrorDetail["code"],
): ValidationErrorDetail => ({
  field,
  message,
  code,
});

const normalizeMimeType = (mimeType: string): string => mimeType.toLowerCase();

const isSupportedMimeType = (mimeType: string): mimeType is (typeof SUPPORTED_AUDIO_MIME_TYPES)[number] =>
  SUPPORTED_AUDIO_MIME_TYPES.includes(mimeType as (typeof SUPPORTED_AUDIO_MIME_TYPES)[number]);

const coerceAudioUpload = (
  file: NewsletterUploadValidationContext["audioFile"],
  durationSeconds?: number,
): MeetingAudioUpload | undefined => {
  if (!file) {
    return undefined;
  }

  const normalizedMime = normalizeMimeType(file.mimetype);
  if (!isSupportedMimeType(normalizedMime)) {
    return undefined;
  }

  return {
    filename: file.originalname,
    mimeType: normalizedMime,
    durationSeconds: durationSeconds ?? 0,
    sizeBytes: file.size,
  };
};

export const validateNewsletterUpload = (
  context: NewsletterUploadValidationContext,
): NewsletterValidationResult & { payload?: NewsletterUploadPayload } => {
  const errors: ValidationErrorDetail[] = [];
  const { audioFile, body } = context;

  const recapText = body.meetingRecapText?.trim() ?? "";
  const transcriptText = body.transcriptText?.trim() ?? "";
  const freeformTopic = body.freeformTopic?.trim();
  const freeformInstructions = body.freeformInstructions?.trim();
  const durationSeconds = body.audioDurationSeconds ?? 0;

  if (!recapText) {
    errors.push(buildError("meetingRecap", "Meeting recap text is required.", "REQUIRED"));
  } else if (recapText.length > MAX_RECAP_LENGTH) {
    errors.push(
      buildError(
        "meetingRecap",
        `Meeting recap must be under ${MAX_RECAP_LENGTH} characters (received ${recapText.length}).`,
        "LIMIT_EXCEEDED",
      ),
    );
  }

  if (!transcriptText) {
    errors.push(buildError("transcript", "Meeting transcript text is required.", "REQUIRED"));
  } else if (transcriptText.length > MAX_TRANSCRIPT_LENGTH) {
    errors.push(
      buildError(
        "transcript",
        `Transcript must be under ${MAX_TRANSCRIPT_LENGTH} characters (received ${transcriptText.length}).`,
        "LIMIT_EXCEEDED",
      ),
    );
  }

  if (freeformTopic && freeformTopic.length > MAX_FREEFORM_TOPIC_LENGTH) {
    errors.push(
      buildError(
        "freeformTopicPrompt.topic",
        `Topic must be under ${MAX_FREEFORM_TOPIC_LENGTH} characters (received ${freeformTopic.length}).`,
        "LIMIT_EXCEEDED",
      ),
    );
  }

  if (freeformInstructions && freeformInstructions.length > MAX_FREEFORM_INSTRUCTIONS_LENGTH) {
    errors.push(
      buildError(
        "freeformTopicPrompt.instructions",
        `Additional instructions must be under ${MAX_FREEFORM_INSTRUCTIONS_LENGTH} characters (received ${freeformInstructions.length}).`,
        "LIMIT_EXCEEDED",
      ),
    );
  }

  let audio: MeetingAudioUpload | undefined;

  if (audioFile) {
    const normalizedMime = normalizeMimeType(audioFile.mimetype);
    if (!isSupportedMimeType(normalizedMime)) {
      errors.push(
        buildError(
          "audio",
          `Unsupported audio format: ${audioFile.mimetype}. Supported formats are MP3 and WAV.`,
          "UNSUPPORTED_TYPE",
        ),
      );
    }

    if (!AUDIO_FILE_NAME_PATTERN.test(audioFile.originalname)) {
      errors.push(buildError("audio", "Audio filename must end with .mp3 or .wav.", "INVALID_FORMAT"));
    }

    if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
      errors.push(
        buildError(
          "audio",
          `Audio file exceeds the ${round_megabytes(MAX_AUDIO_SIZE_BYTES)}MB size limit.`,
          "LIMIT_EXCEEDED",
        ),
      );
    }

    if (durationSeconds <= 0) {
      errors.push(buildError("audio.durationSeconds", "Audio duration metadata is required.", "REQUIRED"));
    } else if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
      errors.push(
        buildError("audio.durationSeconds", "Audio duration must not exceed 60 minutes.", "LIMIT_EXCEEDED"),
      );
    }

    audio = coerceAudioUpload(audioFile, durationSeconds);
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    payload: {
      audio,
      meetingRecap: { text: recapText },
      transcript: { text: transcriptText },
      freeformTopicPrompt: freeformTopic
        ? {
            topic: freeformTopic,
            instructions: freeformInstructions,
          }
        : undefined,
    },
  };
};

function round_megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}
