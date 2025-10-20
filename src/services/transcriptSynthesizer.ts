import {
  ActionItem,
  MeetingRecapInput,
  MeetingTranscriptInput,
  SynthesizedContentSource,
  SynthesizedDecision,
  SynthesizedInsight,
  TranscriptSynthesisResult,
} from "../types/newsletter";

const MAX_COMBINED_TEXT_LENGTH = 20_000;
const DEFAULT_SUMMARY_MAX_LENGTH = 1_000;

export enum TranscriptSynthesizerErrorCode {
  NO_CONTENT_PROVIDED = "NO_CONTENT_PROVIDED",
  SUMMARY_FAILED = "SUMMARY_FAILED",
  DECISION_EXTRACTION_FAILED = "DECISION_EXTRACTION_FAILED",
  ACTION_ITEM_EXTRACTION_FAILED = "ACTION_ITEM_EXTRACTION_FAILED",
  INSIGHT_EXTRACTION_FAILED = "INSIGHT_EXTRACTION_FAILED",
}

export class TranscriptSynthesizerError extends Error {
  public readonly code: TranscriptSynthesizerErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    code: TranscriptSynthesizerErrorCode,
    message: string,
    metadata?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message);
    this.name = "TranscriptSynthesizerError";
    this.code = code;
    this.metadata = metadata;

    if (cause !== undefined) {
      (this as unknown as { cause?: unknown }).cause = cause;
    }
  }
}

export interface BaseSynthesisInput {
  combinedText: string;
  recapText: string;
  transcriptText: string;
}

export interface SummarizeCombinedContentInput extends BaseSynthesisInput {
  maxLength: number;
}

export interface TranscriptSynthesizerDependencies {
  summarize: (input: SummarizeCombinedContentInput) => Promise<string>;
  extractDecisions: (input: BaseSynthesisInput) => Promise<SynthesizedDecision[]>;
  extractActionItems: (input: BaseSynthesisInput) => Promise<ActionItem[]>;
  extractInsights?: (input: BaseSynthesisInput) => Promise<SynthesizedInsight[]>;
}

export interface SynthesizeMeetingContentOptions {
  summaryMaxLength?: number;
}

export interface SynthesizeMeetingContentParams {
  meetingRecap?: MeetingRecapInput;
  transcript?: MeetingTranscriptInput;
  dependencies: TranscriptSynthesizerDependencies;
  options?: SynthesizeMeetingContentOptions;
}

export const synthesizeMeetingContent = async ({
  meetingRecap,
  transcript,
  dependencies,
  options,
}: SynthesizeMeetingContentParams): Promise<TranscriptSynthesisResult> => {
  const recapText = meetingRecap?.text?.trim() ?? "";
  const transcriptText = transcript?.text?.trim() ?? "";

  if (!recapText && !transcriptText) {
    throw new TranscriptSynthesizerError(
      TranscriptSynthesizerErrorCode.NO_CONTENT_PROVIDED,
      "Either a meeting recap or transcript is required to synthesize content.",
    );
  }

  const combined = [recapText, transcriptText].filter(Boolean).join("\n\n");
  const { truncatedText, wasTruncated } = truncateCombinedText(combined);

  const synthesisInput: BaseSynthesisInput = {
    combinedText: truncatedText,
    recapText,
    transcriptText,
  };

  const summaryMaxLength = normalizeSummaryMaxLength(options?.summaryMaxLength);
  const warnings: string[] = [];

  if (wasTruncated) {
    warnings.push(
      `Combined recap and transcript content exceeded ${MAX_COMBINED_TEXT_LENGTH} characters and was truncated for processing.`,
    );
  }

  let summary = "";
  try {
    summary = await dependencies.summarize({
      ...synthesisInput,
      maxLength: summaryMaxLength,
    });
  } catch (error) {
    throw new TranscriptSynthesizerError(
      TranscriptSynthesizerErrorCode.SUMMARY_FAILED,
      "Failed to generate combined summary from recap and transcript.",
      undefined,
      error,
    );
  }

  const normalizedSummary = summary?.trim() ?? "";

  let decisions: SynthesizedDecision[] = [];
  try {
    decisions = await dependencies.extractDecisions(synthesisInput);
  } catch (error) {
    throw new TranscriptSynthesizerError(
      TranscriptSynthesizerErrorCode.DECISION_EXTRACTION_FAILED,
      "Failed to extract key decisions.",
      undefined,
      error,
    );
  }

  let actionItems: ActionItem[] = [];
  try {
    actionItems = await dependencies.extractActionItems(synthesisInput);
  } catch (error) {
    throw new TranscriptSynthesizerError(
      TranscriptSynthesizerErrorCode.ACTION_ITEM_EXTRACTION_FAILED,
      "Failed to extract action items.",
      undefined,
      error,
    );
  }

  let insights: SynthesizedInsight[] = [];
  if (dependencies.extractInsights) {
    try {
      insights = await dependencies.extractInsights(synthesisInput);
    } catch (error) {
      throw new TranscriptSynthesizerError(
        TranscriptSynthesizerErrorCode.INSIGHT_EXTRACTION_FAILED,
        "Failed to extract supporting insights.",
        undefined,
        error,
      );
    }
  }

  const normalizedDecisions = sanitizeDecisions(decisions);
  const normalizedActionItems = sanitizeActionItems(actionItems);
  const normalizedInsights = sanitizeInsights(insights);

  const metadata: TranscriptSynthesisResult["metadata"] = {
    usedRecap: Boolean(recapText),
    usedTranscript: Boolean(transcriptText),
    combinedCharacterCount: truncatedText.length,
    truncatedInput: wasTruncated || undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  return {
    summary: normalizedSummary,
    decisions: normalizedDecisions,
    actionItems: normalizedActionItems,
    insights: normalizedInsights,
    metadata,
  };
};

const truncateCombinedText = (value: string): { truncatedText: string; wasTruncated: boolean } => {
  if (!value) {
    return { truncatedText: "", wasTruncated: false };
  }

  if (value.length <= MAX_COMBINED_TEXT_LENGTH) {
    return { truncatedText: value, wasTruncated: false };
  }

  return { truncatedText: value.slice(0, MAX_COMBINED_TEXT_LENGTH), wasTruncated: true };
};

const normalizeSummaryMaxLength = (value: number | undefined): number => {
  if (!value || value <= 0 || !Number.isFinite(value)) {
    return DEFAULT_SUMMARY_MAX_LENGTH;
  }

  return Math.min(Math.round(value), DEFAULT_SUMMARY_MAX_LENGTH);
};

const sanitizeDecisions = (decisions: SynthesizedDecision[] | undefined): SynthesizedDecision[] => {
  if (!Array.isArray(decisions)) {
    return [];
  }

  return decisions
    .map((decision, index) => ({
      ...decision,
      id: decision?.id ?? `decision-${index + 1}`,
      summary: decision?.summary?.trim() ?? "",
      source: normalizeSource(decision?.source),
      rationale: decision?.rationale?.trim() || undefined,
      supportingEvidence: decision?.supportingEvidence?.trim() || undefined,
    }))
    .filter((decision) => Boolean(decision.summary));
};

const sanitizeActionItems = (items: ActionItem[] | undefined): ActionItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      ...item,
      id: item?.id ?? `action-${index + 1}`,
      summary: item?.summary?.trim() ?? "",
      owner: item?.owner?.trim() || undefined,
      dueDate: item?.dueDate || undefined,
      status: item?.status || undefined,
      source: normalizeSource(item?.source),
    }))
    .filter((item) => Boolean(item.summary));
};

const sanitizeInsights = (insights: SynthesizedInsight[] | undefined): SynthesizedInsight[] => {
  if (!Array.isArray(insights)) {
    return [];
  }

  return insights
    .map((insight, index) => ({
      ...insight,
      id: insight?.id ?? `insight-${index + 1}`,
      summary: insight?.summary?.trim() ?? "",
      source: normalizeSource(insight?.source),
      quote: insight?.quote?.trim() || undefined,
      category: insight?.category?.trim() || undefined,
    }))
    .filter((insight) => Boolean(insight.summary));
};

const normalizeSource = (source: SynthesizedContentSource | undefined): SynthesizedContentSource => {
  if (source === "recap" || source === "transcript" || source === "both") {
    return source;
  }

  return "both";
};

export const deriveSourceFromPresence = ({
  recapText,
  transcriptText,
}: {
  recapText: string;
  transcriptText: string;
}): SynthesizedContentSource => {
  if (recapText && transcriptText) {
    return "both";
  }

  if (recapText) {
    return "recap";
  }

  if (transcriptText) {
    return "transcript";
  }

  return "both";
};

export const buildDefaultActionItem = (
  summary: string,
  source: SynthesizedContentSource,
  overrides?: Partial<ActionItem>,
): ActionItem => ({
  id: overrides?.id ?? `action-${Date.now()}`,
  summary: summary.trim(),
  owner: overrides?.owner?.trim() || undefined,
  dueDate: overrides?.dueDate || undefined,
  status: overrides?.status || undefined,
  source,
});

