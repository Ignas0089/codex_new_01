import {
  ActionItem,
  AudioHighlight,
  FreeformTopicPrompt,
  FreeformTopicSuggestion,
  SynthesizedDecision,
  SynthesizedInsight,
} from "../types/newsletter";

const DEFAULT_TITLE = "Additional Topic";
const DEFAULT_BODY =
  "Use this space to add any announcements or highlights that didn't fit into the main sections. Update the copy as needed before sharing.";
const DEFAULT_TONE_GUIDANCE =
  "Friendly internal tone: highlight wins, appreciate contributors, and reinforce next steps.";
const DEFAULT_MAX_BODY_LENGTH = 1500;

export interface FreeformTopicContext {
  summary?: string;
  decisions?: SynthesizedDecision[];
  insights?: SynthesizedInsight[];
  actionItems?: ActionItem[];
  audioHighlights?: AudioHighlight[];
}

export interface DraftFreeformTopicInput {
  prompt?: FreeformTopicPrompt;
  context: {
    summary?: string;
    decisions: { id: string; summary: string }[];
    insights: { id: string; summary: string }[];
    actionItems: { id: string; summary: string; owner?: string }[];
    audioHighlights: { id: string; summary: string }[];
    tone: string;
    maxBodyLength: number;
  };
}

export interface DraftFreeformTopicResult {
  title?: string | null;
  body?: string | null;
  confidence?: number | null;
  toneGuidance?: string | null;
  isPromptAligned?: boolean | null;
}

export interface FreeformTopicGeneratorDependencies {
  draftCopy: (input: DraftFreeformTopicInput) => Promise<DraftFreeformTopicResult>;
}

export interface GenerateFreeformTopicOptions {
  maxBodyLength?: number;
  defaultToneGuidance?: string;
}

export interface GenerateFreeformTopicParams {
  prompt?: FreeformTopicPrompt;
  context?: FreeformTopicContext;
}

export type GenerateFreeformTopic = (params: GenerateFreeformTopicParams) => Promise<FreeformTopicSuggestion>;

interface CreateGeneratorArgs {
  dependencies: FreeformTopicGeneratorDependencies;
  options?: GenerateFreeformTopicOptions;
}

export const createFreeformTopicGenerator = ({
  dependencies,
  options,
}: CreateGeneratorArgs): GenerateFreeformTopic => async ({ prompt, context }) => {
  const normalizedPrompt = normalizePrompt(prompt);
  const normalizedContext = normalizeContext(context);
  const fallbackTone = options?.defaultToneGuidance?.trim() || DEFAULT_TONE_GUIDANCE;
  const maxBodyLength = normalizeMaxBodyLength(options?.maxBodyLength);

  try {
    const draft = await dependencies.draftCopy({
      prompt: normalizedPrompt,
      context: {
        summary: normalizedContext.summary,
        decisions: normalizedContext.decisions,
        insights: normalizedContext.insights,
        actionItems: normalizedContext.actionItems,
        audioHighlights: normalizedContext.audioHighlights,
        tone: fallbackTone,
        maxBodyLength,
      },
    });

    return buildSuggestion({
      prompt: normalizedPrompt,
      draft,
      toneFallback: fallbackTone,
      maxBodyLength,
    });
  } catch (error) {
    console.warn("Failed to generate freeform topic copy", error);
    return buildFallbackSuggestion({
      prompt: normalizedPrompt,
      toneFallback: fallbackTone,
    });
  }
};

interface BuildSuggestionArgs {
  prompt?: FreeformTopicPrompt;
  draft?: DraftFreeformTopicResult | null;
  toneFallback: string;
  maxBodyLength: number;
}

const buildSuggestion = ({
  prompt,
  draft,
  toneFallback,
  maxBodyLength,
}: BuildSuggestionArgs): FreeformTopicSuggestion => {
  const title = sanitizeText(draft?.title) || prompt?.topic || DEFAULT_TITLE;
  const body = truncateBody(sanitizeText(draft?.body) || DEFAULT_BODY, maxBodyLength);

  const toneGuidance = sanitizeText(draft?.toneGuidance) || toneFallback;
  const confidence = normalizeConfidence(draft?.confidence);
  const isPromptAligned = typeof draft?.isPromptAligned === "boolean"
    ? draft?.isPromptAligned
    : Boolean(prompt);

  return {
    prompt,
    title,
    body,
    toneGuidance,
    confidence,
    isPromptAligned,
  };
};

interface BuildFallbackSuggestionArgs {
  prompt?: FreeformTopicPrompt;
  toneFallback: string;
}

const buildFallbackSuggestion = ({
  prompt,
  toneFallback,
}: BuildFallbackSuggestionArgs): FreeformTopicSuggestion => ({
  prompt,
  title: prompt?.topic || DEFAULT_TITLE,
  body: DEFAULT_BODY,
  toneGuidance: toneFallback,
  isPromptAligned: Boolean(prompt),
});

const normalizePrompt = (prompt?: FreeformTopicPrompt): FreeformTopicPrompt | undefined => {
  if (!prompt) {
    return undefined;
  }

  const topic = prompt.topic?.trim();
  const instructions = prompt.instructions?.trim();

  if (!topic && !instructions) {
    return undefined;
  }

  return {
    ...(topic ? { topic } : { topic: DEFAULT_TITLE }),
    ...(instructions ? { instructions } : {}),
  };
};

const normalizeContext = (context?: FreeformTopicContext) => {
  const summary = context?.summary?.trim();
  const decisions = Array.isArray(context?.decisions)
    ? context!.decisions
        .map(({ id, summary: decisionSummary }) => ({
          id,
          summary: decisionSummary?.trim() || "",
        }))
        .filter((item) => item.id && item.summary)
    : [];

  const insights = Array.isArray(context?.insights)
    ? context!.insights
        .map(({ id, summary }) => ({
          id,
          summary: summary?.trim() || "",
        }))
        .filter((item) => item.id && item.summary)
    : [];

  const actionItems = Array.isArray(context?.actionItems)
    ? context!.actionItems
        .map(({ id, summary, owner }) => ({
          id,
          summary: summary?.trim() || "",
          ...(owner?.trim() ? { owner: owner.trim() } : {}),
        }))
        .filter((item) => item.id && item.summary)
    : [];

  const audioHighlights = Array.isArray(context?.audioHighlights)
    ? context!.audioHighlights
        .map(({ id, summary }) => ({
          id,
          summary: summary?.trim() || "",
        }))
        .filter((item) => item.id && item.summary)
    : [];

  return { summary, decisions, insights, actionItems, audioHighlights };
};

const sanitizeText = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
};

const truncateBody = (body: string, maxLength: number): string => {
  if (body.length <= maxLength) {
    return body;
  }

  return `${body.slice(0, maxLength - 1).trim()}…`;
};

const normalizeConfidence = (confidence?: number | null): number | undefined => {
  if (confidence === null || confidence === undefined) {
    return undefined;
  }

  if (!Number.isFinite(confidence)) {
    return undefined;
  }

  const bounded = Math.max(0, Math.min(1, confidence));
  return Number.isNaN(bounded) ? undefined : bounded;
};

const normalizeMaxBodyLength = (maxBodyLength?: number): number => {
  if (!maxBodyLength || !Number.isFinite(maxBodyLength) || maxBodyLength < 200) {
    return DEFAULT_MAX_BODY_LENGTH;
  }

  return Math.min(Math.round(maxBodyLength), 3000);
};
