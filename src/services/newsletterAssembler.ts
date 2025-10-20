import {
  ActionItem,
  AudioHighlightsSummary,
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

  const structured = buildStructuredNewsletter({
    request,
    audioSummary,
    transcriptSynthesis,
    generateId,
  });

  const createdAt = (now ?? defaultNowFactory)().toISOString();
  const processingTimeMs = Date.now() - startedAt;

  return {
    sections: structured,
    metadata: {
      createdAt,
      processingTimeMs,
      audioSummaryIncluded: Boolean(audioSummary),
    },
  };
};

interface BuildStructuredNewsletterArgs {
  request: NewsletterGenerationRequest;
  audioSummary?: AudioHighlightsSummary;
  transcriptSynthesis: TranscriptSynthesisResult;
  generateId?: IdFactory;
}

const buildStructuredNewsletter = ({
  request,
  audioSummary,
  transcriptSynthesis,
  generateId,
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
  const actionItems = normalizeActionItems(transcriptSynthesis.actionItems);
  const closing = buildClosingSection({
    transcriptSynthesis,
    actionItemCount: actionItems.length,
    audioSummary,
    generateId,
  });
  const freeformTopic = buildFreeformSuggestion({
    promptTopic: request.freeformTopicPrompt?.topic,
    promptInstructions: request.freeformTopicPrompt?.instructions,
  });

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

const normalizeActionItems = (actionItems: ActionItem[]): ActionItem[] => {
  if (!actionItems?.length) {
    return [];
  }

  return actionItems.map((item) => ({
    ...item,
    summary: item.summary.trim(),
  }));
};

interface BuildFreeformSuggestionArgs {
  promptTopic?: string;
  promptInstructions?: string;
}

const buildFreeformSuggestion = ({
  promptTopic,
  promptInstructions,
}: BuildFreeformSuggestionArgs): FreeformTopicSuggestion => {
  const title = promptTopic?.trim() || "Additional Topic";
  const intro = promptInstructions?.trim();

  const bodySegments: string[] = [];

  if (intro) {
    bodySegments.push(intro);
  }

  bodySegments.push(
    "Use this space to add any announcements or highlights that didn't fit into the main sections. Update the copy as needed before sharing.",
  );

  const prompt = promptTopic || promptInstructions
    ? {
        topic: promptTopic ?? "",
        ...(promptInstructions ? { instructions: promptInstructions } : {}),
      }
    : undefined;

  return {
    prompt,
    title,
    body: bodySegments.join("\n\n"),
    isPromptAligned: Boolean(promptTopic || promptInstructions),
  };
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
