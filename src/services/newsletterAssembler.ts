import {
  ActionItem,
  ActionItemsSection,
  AudioHighlightsSummary,
  FreeformTopicPrompt,
  FreeformTopicSuggestion,
  MeetingAudioUpload,
  MeetingRecapInput,
  MeetingTranscriptInput,
  NewsletterGenerationRequest,
  NewsletterGenerationResponse,
  NewsletterSection,
  StructuredNewsletter,
  TranscriptSynthesisResult,
} from "../types/newsletter";
import { type GenerateFreeformTopic } from "./freeformTopicGenerator";

const DEFAULT_FREEFORM_TONE_GUIDANCE =
  "Friendly internal tone: highlight wins, appreciate contributors, and reinforce next steps.";

type IdFactory = () => string;
type NowFactory = () => Date;

export interface SummarizeAudioParams {
  audio?: MeetingAudioUpload;
  audioData?: Uint8Array;
}

export interface SummarizeAudio {
  (params: SummarizeAudioParams): Promise<AudioHighlightsSummary>;
}

export interface SynthesizeContentParams {
  meetingRecap?: MeetingRecapInput;
  transcript?: MeetingTranscriptInput;
}

export interface SynthesizeContent {
  (params: SynthesizeContentParams): Promise<TranscriptSynthesisResult>;
}

export interface AssembleNewsletterDependencies {
  summarizeAudio?: SummarizeAudio;
  synthesizeContent: SynthesizeContent;
  generateFreeformTopic?: GenerateFreeformTopic;
  generateId?: IdFactory;
  now?: NowFactory;
}

export interface AssembleNewsletterParams {
  request: NewsletterGenerationRequest;
  audioData?: Uint8Array;
  dependencies: AssembleNewsletterDependencies;
}

export const assembleNewsletter = async ({
  request,
  audioData,
  dependencies,
}: AssembleNewsletterParams): Promise<NewsletterGenerationResponse> => {
  const startedAt = Date.now();
  const { summarizeAudio, synthesizeContent, generateId, now } = dependencies;

  const [audioSummary, transcriptSynthesis] = await Promise.all([
    maybeSummarizeAudio(summarizeAudio, {
      audio: request.audio,
      audioData,
    }),
    synthesizeContent({
      meetingRecap: request.meetingRecap,
      transcript: request.transcript,
    }),
  ]);

  const freeformSuggestion = await maybeGenerateFreeformTopic(dependencies.generateFreeformTopic, {
    prompt: request.freeformTopicPrompt,
    audioSummary,
    transcriptSynthesis,
  });

  const structured = buildStructuredNewsletter({
    request,
    audioSummary,
    transcriptSynthesis,
    generateId,
    freeformSuggestion,
  });

  const createdAt = (now ?? defaultNowFactory)().toISOString();
  const processingTimeMs = Date.now() - startedAt;
  const warnings = collectWarnings({ audioSummary, transcriptSynthesis });

  return {
    sections: structured,
    metadata: {
      createdAt,
      processingTimeMs,
      audioSummaryIncluded: Boolean(audioSummary),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

interface CollectWarningsArgs {
  audioSummary?: AudioHighlightsSummary;
  transcriptSynthesis: TranscriptSynthesisResult;
}

const collectWarnings = ({
  audioSummary,
  transcriptSynthesis,
}: CollectWarningsArgs): string[] => {
  const aggregated: string[] = [];

  if (audioSummary?.warnings?.length) {
    aggregated.push(...audioSummary.warnings);
  }

  if (transcriptSynthesis.metadata.warnings?.length) {
    aggregated.push(...transcriptSynthesis.metadata.warnings);
  }

  return aggregated;
};

interface BuildStructuredNewsletterArgs {
  request: NewsletterGenerationRequest;
  audioSummary?: AudioHighlightsSummary;
  transcriptSynthesis: TranscriptSynthesisResult;
  generateId?: IdFactory;
  freeformSuggestion?: FreeformTopicSuggestion;
}

const buildStructuredNewsletter = ({
  request,
  audioSummary,
  transcriptSynthesis,
  generateId,
  freeformSuggestion,
}: BuildStructuredNewsletterArgs): StructuredNewsletter => {
  const introduction = buildIntroductionSection({
    transcriptSynthesis,
    audioSummary,
    generateId,
  });
  const mainUpdates = buildMainUpdatesSections({
    transcriptSynthesis,
    audioSummary,
    generateId,
  });
  const actionItems = buildActionItemsSection({
    actionItems: transcriptSynthesis.actionItems,
    generateId,
  });
  const closing = buildClosingSection({
    transcriptSynthesis,
    actionItemCount: actionItems.items.length,
    audioSummary,
    generateId,
  });
  const freeformTopic =
    freeformSuggestion ?? buildFreeformSuggestion({ prompt: request.freeformTopicPrompt });

  return {
    introduction,
    mainUpdates,
    actionItems,
    closing,
    freeformTopic,
  };
};

interface BuildIntroductionArgs {
  transcriptSynthesis: TranscriptSynthesisResult;
  audioSummary?: AudioHighlightsSummary;
  generateId?: IdFactory;
}

const buildIntroductionSection = ({
  transcriptSynthesis,
  audioSummary,
  generateId,
}: BuildIntroductionArgs): NewsletterSection => {
  const summaryText = transcriptSynthesis.summary.trim();
  const introLines: string[] = [];

  if (summaryText) {
    introLines.push(summaryText);
  }

  if (audioSummary?.highlights?.length) {
    const highlightSnippets = audioSummary.highlights
      .slice(0, 3)
      .map((highlight) => `• ${highlight.summary}`)
      .join("\n");

    introLines.push(`Audio callouts:\n${highlightSnippets}`);
  }

  if (introLines.length === 0) {
    introLines.push("This week's update covers the latest progress and next steps from the team.");
  }

  return {
    id: generateId ? generateId() : "introduction",
    title: "Introduction",
    body: introLines.join("\n\n"),
  };
};

interface BuildMainUpdatesArgs {
  transcriptSynthesis: TranscriptSynthesisResult;
  audioSummary?: AudioHighlightsSummary;
  generateId?: IdFactory;
}

const buildMainUpdatesSections = ({
  transcriptSynthesis,
  audioSummary,
  generateId,
}: BuildMainUpdatesArgs): NewsletterSection[] => {
  const sections: NewsletterSection[] = [];
  const decisionsBody = formatDecisions(transcriptSynthesis.decisions);

  if (decisionsBody) {
    sections.push({
      id: generateId ? generateId() : "main-updates-decisions",
      title: "Key Decisions",
      body: decisionsBody,
    });
  }

  const insightsBody = formatInsightsAndHighlights({
    insights: transcriptSynthesis.insights,
    audioSummary,
  });

  if (insightsBody) {
    sections.push({
      id: generateId ? generateId() : "main-updates-highlights",
      title: "Highlights & Insights",
      body: insightsBody,
      highlights: audioSummary?.highlights?.map((highlight) => highlight.summary),
    });
  }

  if (sections.length === 0) {
    sections.push({
      id: generateId ? generateId() : "main-updates-overview",
      title: "Main Updates",
      body: "No major updates were captured this cycle. Please review the action items and closing notes for next steps.",
    });
  }

  return sections;
};

const formatDecisions = (decisions: TranscriptSynthesisResult["decisions"]): string | undefined => {
  if (!decisions?.length) {
    return undefined;
  }

  const lines = decisions.map((decision) => {
    const segments = [decision.summary];

    if (decision.rationale) {
      segments.push(`Why it matters: ${decision.rationale}`);
    }

    return `• ${segments.join(" \u2014 ")}`;
  });

  return lines.join("\n");
};

interface FormatInsightsArgs {
  insights: TranscriptSynthesisResult["insights"];
  audioSummary?: AudioHighlightsSummary;
}

const formatInsightsAndHighlights = ({
  insights,
  audioSummary,
}: FormatInsightsArgs): string | undefined => {
  const lines: string[] = [];

  if (insights?.length) {
    lines.push(
      ...insights.map((insight) => {
        const segments = [insight.summary];
        if (insight.quote) {
          segments.push(`Quote: "${insight.quote}"`);
        }
        return `• ${segments.join(" \u2014 ")}`;
      }),
    );
  }

  if (audioSummary?.highlights?.length) {
    lines.push(
      ...audioSummary.highlights.map((highlight) => {
        const segments = [highlight.summary];
        if (typeof highlight.startTimeSeconds === "number") {
          segments.push(`Timestamp: ${formatTimestamp(highlight.startTimeSeconds)}`);
        }
        return `• ${segments.join(" \u2014 ")}`;
      }),
    );
  }

  if (lines.length === 0) {
    return undefined;
  }

  return lines.join("\n");
};

const formatTimestamp = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface BuildClosingArgs {
  transcriptSynthesis: TranscriptSynthesisResult;
  actionItemCount: number;
  audioSummary?: AudioHighlightsSummary;
  generateId?: IdFactory;
}

const buildClosingSection = ({
  transcriptSynthesis,
  actionItemCount,
  audioSummary,
  generateId,
}: BuildClosingArgs): NewsletterSection => {
  const lines: string[] = [];

  if (actionItemCount > 0) {
    lines.push(`Please review the ${actionItemCount} action item(s) listed above and confirm ownership.`);
  }

  if (audioSummary?.warnings?.length) {
    lines.push(...audioSummary.warnings.map((warning) => `Note: ${warning}`));
  }

  if (!lines.length && transcriptSynthesis.summary) {
    lines.push("Thank you for staying aligned. Reach out if any clarifications are needed before the next check-in.");
  }

  if (!lines.length) {
    lines.push("Thanks for reading and keep up the great work!");
  }

  return {
    id: generateId ? generateId() : "closing",
    title: "Closing",
    body: lines.join("\n\n"),
  };
};

interface BuildActionItemsSectionArgs {
  actionItems: ActionItem[];
  generateId?: IdFactory;
}

const buildActionItemsSection = ({
  actionItems,
  generateId,
}: BuildActionItemsSectionArgs): ActionItemsSection => {
  const normalizedItems = normalizeActionItems(actionItems);

  const lines = normalizedItems.map(formatActionItemLine);

  const body = lines.length
    ? lines.join("\n")
    : "No action items were captured for this update. Check in with the team to confirm next steps.";

  return {
    id: generateId ? generateId() : "action-items",
    title: "Action Items",
    body,
    items: normalizedItems,
  };
};

const normalizeActionItems = (actionItems: ActionItem[]): ActionItem[] => {
  if (!actionItems?.length) {
    return [];
  }

  return actionItems.map((item, index) => {
    const summary = item.summary?.trim();
    const owner = item.owner?.trim();
    const dueDate = item.dueDate?.trim();

    return {
      ...item,
      summary: summary || `Follow up item ${index + 1}`,
      ...(owner ? { owner } : {}),
      ...(dueDate ? { dueDate } : {}),
    };
  });
};

const formatActionItemLine = (item: ActionItem): string => {
  const details: string[] = [];

  if (item.owner) {
    details.push(`Owner: ${item.owner}`);
  }

  if (item.dueDate) {
    details.push(`Due: ${formatDueDate(item.dueDate)}`);
  }

  const detailsSuffix = details.length ? ` — ${details.join(" | ")}` : "";

  return `• ${item.summary}${detailsSuffix}`;
};

const formatDueDate = (isoDate: string): string => {
  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface BuildFreeformSuggestionArgs {
  prompt?: FreeformTopicPrompt;
}

const buildFreeformSuggestion = ({
  prompt,
}: BuildFreeformSuggestionArgs): FreeformTopicSuggestion => {
  const promptTopic = prompt?.topic?.trim();
  const promptInstructions = prompt?.instructions?.trim();

  const title = promptTopic || "Additional Topic";
  const intro = promptInstructions;

  const bodySegments: string[] = [];

  if (intro) {
    bodySegments.push(intro);
  }

  bodySegments.push(
    "Use this space to add any announcements or highlights that didn't fit into the main sections. Update the copy as needed before sharing.",
  );

  return {
    prompt:
      promptTopic || promptInstructions
        ? {
            topic: promptTopic ?? "Additional Topic",
            ...(promptInstructions ? { instructions: promptInstructions } : {}),
          }
        : undefined,
    title,
    body: bodySegments.join("\n\n"),
    isPromptAligned: Boolean(promptTopic || promptInstructions),
    toneGuidance: DEFAULT_FREEFORM_TONE_GUIDANCE,
  };
};

interface MaybeGenerateFreeformTopicArgs {
  prompt?: FreeformTopicPrompt;
  audioSummary?: AudioHighlightsSummary;
  transcriptSynthesis: TranscriptSynthesisResult;
}

const maybeGenerateFreeformTopic = async (
  generateFreeformTopic: GenerateFreeformTopic | undefined,
  { prompt, audioSummary, transcriptSynthesis }: MaybeGenerateFreeformTopicArgs,
): Promise<FreeformTopicSuggestion | undefined> => {
  if (!generateFreeformTopic) {
    return undefined;
  }

  try {
    const suggestion = await generateFreeformTopic({
      prompt,
      context: {
        summary: transcriptSynthesis.summary,
        decisions: transcriptSynthesis.decisions,
        insights: transcriptSynthesis.insights,
        actionItems: transcriptSynthesis.actionItems,
        audioHighlights: audioSummary?.highlights,
      },
    });

    return {
      ...suggestion,
      toneGuidance: suggestion.toneGuidance?.trim() || DEFAULT_FREEFORM_TONE_GUIDANCE,
    };
  } catch (error) {
    console.warn("Failed to generate freeform topic suggestion", error);
    return undefined;
  }
};

const maybeSummarizeAudio = async (
  summarizeAudio: SummarizeAudio | undefined,
  params: SummarizeAudioParams,
): Promise<AudioHighlightsSummary | undefined> => {
  if (!summarizeAudio || !params.audio) {
    return undefined;
  }

  try {
    return await summarizeAudio(params);
  } catch (error) {
    console.warn("Failed to summarize meeting audio", error);
    return undefined;
  }
};

const defaultNowFactory: NowFactory = () => new Date();
