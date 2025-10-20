import {
  NewsletterUploadPayload,
  ValidationErrorDetail,
  NewsletterGenerationResponse,
} from "../../types/newsletter";
import {
  NewsletterUploadValidationContext,
  UploadedFileDescriptor,
} from "./newsletterUploadValidator";

const buildError = (
  field: string,
  message: string,
  code?: ValidationErrorDetail["code"],
): ValidationErrorDetail => ({
  field,
  message,
  code,
});

const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

const normalizeString = (
  value: unknown,
  field: string,
  errors: ValidationErrorDetail[],
): string | undefined => {
  if (isNil(value)) {
    return undefined;
  }

  const normalized = Array.isArray(value) ? value[0] : value;

  if (typeof normalized === "string") {
    return normalized;
  }

  if (typeof normalized === "number" || typeof normalized === "boolean") {
    return String(normalized);
  }

  errors.push(buildError(field, "Expected a string value.", "INVALID_FORMAT"));
  return undefined;
};

const normalizeNumber = (
  value: unknown,
  field: string,
  errors: ValidationErrorDetail[],
): number | undefined => {
  if (isNil(value)) {
    return undefined;
  }

  const normalized = Array.isArray(value) ? value[0] : value;

  if (typeof normalized === "number") {
    if (!Number.isFinite(normalized)) {
      errors.push(buildError(field, "Value must be a finite number.", "INVALID_FORMAT"));
      return undefined;
    }

    return normalized;
  }

  if (typeof normalized === "string") {
    const trimmed = normalized.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      errors.push(buildError(field, "Unable to parse numeric value.", "INVALID_FORMAT"));
      return undefined;
    }

    return parsed;
  }

  errors.push(buildError(field, "Expected a numeric value.", "INVALID_FORMAT"));
  return undefined;
};

export interface SchemaSuccess<T> {
  success: true;
  data: T;
}

export interface SchemaFailure {
  success: false;
  errors: ValidationErrorDetail[];
}

export type SchemaResult<T> = SchemaSuccess<T> | SchemaFailure;

export type RawNewsletterUploadRequest = {
  meetingRecapText?: unknown;
  transcriptText?: unknown;
  freeformTopic?: unknown;
  freeformInstructions?: unknown;
  audioDurationSeconds?: unknown;
};

export const parseNewsletterUploadRequest = (
  body: RawNewsletterUploadRequest | null | undefined,
  file?: UploadedFileDescriptor,
): SchemaResult<NewsletterUploadValidationContext> => {
  const errors: ValidationErrorDetail[] = [];

  const normalizedBody: RawNewsletterUploadRequest = body ?? {};

  const meetingRecapText = normalizeString(
    normalizedBody.meetingRecapText,
    "meetingRecapText",
    errors,
  );
  const transcriptText = normalizeString(normalizedBody.transcriptText, "transcriptText", errors);
  const freeformTopic = normalizeString(normalizedBody.freeformTopic, "freeformTopic", errors);
  const freeformInstructions = normalizeString(
    normalizedBody.freeformInstructions,
    "freeformInstructions",
    errors,
  );
  const audioDurationSeconds = normalizeNumber(
    normalizedBody.audioDurationSeconds,
    "audioDurationSeconds",
    errors,
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      audioFile: file,
      body: {
        meetingRecapText,
        transcriptText,
        freeformTopic,
        freeformInstructions,
        audioDurationSeconds,
      },
    },
  };
};

export interface NewsletterUploadSuccessResponse {
  message: string;
  payload: NewsletterUploadPayload;
  newsletter: NewsletterGenerationResponse;
}

export interface NewsletterUploadErrorResponse {
  errors: ValidationErrorDetail[];
}

export const serializeNewsletterUploadSuccessResponse = (
  payload: NewsletterUploadPayload,
  newsletter: NewsletterGenerationResponse,
): NewsletterUploadSuccessResponse => ({
  message: "Newsletter assembled successfully.",
  payload,
  newsletter,
});

export const serializeNewsletterUploadErrorResponse = (
  errors: ValidationErrorDetail[],
): NewsletterUploadErrorResponse => ({
  errors,
});
