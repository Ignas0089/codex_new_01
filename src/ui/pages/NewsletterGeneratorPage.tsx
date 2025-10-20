import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ActionItem,
  ActionItemsSection,
  MAX_AUDIO_DURATION_SECONDS,
  NewsletterGenerationResponse,
  NewsletterSection,
  StructuredNewsletter,
  SUPPORTED_AUDIO_MIME_TYPES,
  NewsletterUploadPayload,
  ValidationErrorDetail,
} from "../../types/newsletter";
import { NewsletterSectionEditor } from "../components/NewsletterSectionEditor";

type MinutesInput = string;

interface FormState {
  audioFile: File | null;
  audioDurationMinutes: MinutesInput;
  meetingRecap: string;
  recapAuthor: string;
  transcript: string;
  transcriptSource: string;
  freeformTopic: string;
  freeformInstructions: string;
}

interface DraftSummary {
  meetingRecapLength: number;
  transcriptLength: number;
}

const MAX_FREEFORM_TOPIC_LENGTH = 80;
const MAX_FREEFORM_INSTRUCTIONS_LENGTH = 500;
const FREEFORM_SECTION_ID = "freeform-topic-preview";

const KNOWN_ERROR_FIELDS = new Set([
  "meetingRecap",
  "transcript",
  "freeformTopicPrompt.topic",
  "freeformTopic",
  "freeformTopicPrompt.instructions",
  "freeformInstructions",
  "audio",
  "audio.durationSeconds",
]);

type SubmissionState = "idle" | "submitting" | "succeeded" | "failed";

interface UploadSuccessResponse {
  message?: string;
  payload: NewsletterUploadPayload;
  newsletter: NewsletterGenerationResponse;
}

interface UploadErrorResponse {
  errors?: ValidationErrorDetail[];
}

interface NewsletterCopyFeedback {
  status: "idle" | "success" | "error";
  message?: string;
}

const initialState: FormState = {
  audioFile: null,
  audioDurationMinutes: "",
  meetingRecap: "",
  recapAuthor: "",
  transcript: "",
  transcriptSource: "",
  freeformTopic: "",
  freeformInstructions: "",
};

/**
 * NewsletterGeneratorPage collects all user provided inputs required for generating an
 * internal team newsletter. It captures uploads, written context, and optional freeform
 * prompts while delegating generation to the backend API. The page surfaces validation
 * errors, renders editable previews, and offers copy controls for the assembled content.
 */
export const NewsletterGeneratorPage: React.FC = () => {
  const [formState, setFormState] = useState<FormState>(initialState);
  const [draftSections, setDraftSections] = useState<StructuredNewsletter | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [serverErrors, setServerErrors] = useState<ValidationErrorDetail[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newsletterCopyFeedback, setNewsletterCopyFeedback] = useState<NewsletterCopyFeedback>({
    status: "idle",
  });
  const [newsletterWarnings, setNewsletterWarnings] = useState<string[]>([]);
  const [newsletterMetadata, setNewsletterMetadata] =
    useState<NewsletterGenerationResponse["metadata"] | null>(null);

  const allowedAudioTypesLabel = useMemo(
    () => SUPPORTED_AUDIO_MIME_TYPES.map((type) => type.replace("audio/", "")).join(", "),
    []
  );

  const draftSummary: DraftSummary = useMemo(
    () => ({
      meetingRecapLength: formState.meetingRecap.trim().length,
      transcriptLength: formState.transcript.trim().length,
    }),
    [formState.meetingRecap, formState.transcript]
  );

  const fieldErrorMap = useMemo(
    () =>
      serverErrors.reduce<Record<string, string[]>>((accumulator, error) => {
        if (!accumulator[error.field]) {
          accumulator[error.field] = [];
        }
        accumulator[error.field].push(error.message);
        return accumulator;
      }, {}),
    [serverErrors]
  );

  const renderFieldErrors = (field: string, fallbackField?: string) => {
    const messages = [
      ...(fieldErrorMap[field] ?? []),
      ...(fallbackField ? fieldErrorMap[fallbackField] ?? [] : []),
    ];

    return messages.map((message, index) => (
      <p key={`${field}-${index}`} className="form-error">
        {message}
      </p>
    ));
  };

  const generalErrors = useMemo(
    () => serverErrors.filter((error) => !KNOWN_ERROR_FIELDS.has(error.field)),
    [serverErrors]
  );

  const resetForm = () => {
    setFormState(initialState);
    setDraftSections(null);
    setSubmissionState("idle");
    setServerErrors([]);
    setStatusMessage(null);
    setNewsletterCopyFeedback({ status: "idle" });
    setNewsletterWarnings([]);
    setNewsletterMetadata(null);
  };

  const handleAudioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    setFormState((previous) => ({
      ...previous,
      audioFile: file,
    }));
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    if (/^\d*(\.\d*)?$/.test(value) || value === "") {
      setFormState((previous) => ({
        ...previous,
        audioDurationMinutes: value,
      }));
    }
  };

  const handleTextChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.currentTarget;
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submissionState === "submitting") {
      return;
    }

    setSubmissionState("submitting");
    setStatusMessage(null);
    setServerErrors([]);
    setNewsletterCopyFeedback({ status: "idle" });

    const formData = new FormData();
    formData.append("meetingRecapText", formState.meetingRecap);
    formData.append("transcriptText", formState.transcript);

    const trimmedTopic = formState.freeformTopic.trim();
    if (trimmedTopic) {
      formData.append("freeformTopic", trimmedTopic);
    }

    const trimmedInstructions = formState.freeformInstructions.trim();
    if (trimmedInstructions) {
      formData.append("freeformInstructions", trimmedInstructions);
    }

    if (audioDurationSeconds !== undefined) {
      formData.append("audioDurationSeconds", String(audioDurationSeconds));
    }

    if (formState.audioFile) {
      formData.append("audio", formState.audioFile);
    }

    try {
      const response = await fetch("/newsletters", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || typeof data !== "object") {
        const errorData = (data as UploadErrorResponse | null) ?? undefined;
        const errors = errorData?.errors?.length ? errorData.errors : undefined;
        setServerErrors(
          errors ?? [{ field: "form", message: "Unexpected error while processing the upload." }],
        );
        setStatusMessage("We couldn’t process the upload. Please review the highlighted fields.");
        setSubmissionState("failed");
        setNewsletterWarnings([]);
        setNewsletterMetadata(null);
        return;
      }

      const successData = data as UploadSuccessResponse;
      if (!successData.payload || !successData.newsletter) {
        setStatusMessage("Received an unexpected response from the server. Please try again.");
        setSubmissionState("failed");
        setNewsletterWarnings([]);
        setNewsletterMetadata(null);
        return;
      }
      const sanitizedState = buildSanitizedFormState(formState, successData.payload);
      setFormState(sanitizedState);
      setDraftSections(successData.newsletter.sections);
      setNewsletterWarnings(successData.newsletter.warnings ?? []);
      setNewsletterMetadata(successData.newsletter.metadata);
      setServerErrors([]);
      setSubmissionState("succeeded");
      setStatusMessage(successData.message ?? "Draft prepared. Review the generated sections below.");
    } catch (error) {
      console.error("Failed to submit newsletter upload", error);
      setServerErrors([{ field: "form", message: "Network error while submitting. Please try again." }]);
      setStatusMessage("Network error while submitting. Please try again.");
      setSubmissionState("failed");
      setNewsletterWarnings([]);
      setNewsletterMetadata(null);
    }
  };

  const audioDurationSeconds = useMemo(() => {
    if (!formState.audioDurationMinutes) {
      return undefined;
    }
    const minutes = Number.parseFloat(formState.audioDurationMinutes);
    if (Number.isNaN(minutes)) {
      return undefined;
    }
    return Math.round(minutes * 60);
  }, [formState.audioDurationMinutes]);

  const audioDurationWarning = useMemo(() => {
    if (audioDurationSeconds === undefined) {
      return undefined;
    }
    if (audioDurationSeconds > MAX_AUDIO_DURATION_SECONDS) {
      const maxMinutes = Math.floor(MAX_AUDIO_DURATION_SECONDS / 60);
      return `Audio duration exceeds ${maxMinutes} minutes. Please upload a shorter clip.`;
    }
    return undefined;
  }, [audioDurationSeconds]);

  const freeformSection = useMemo(() => {
    if (!draftSections) {
      return undefined;
    }

    return {
      id: FREEFORM_SECTION_ID,
      title:
        draftSections.freeformTopic.title ||
        draftSections.freeformTopic.prompt?.topic ||
        "Freeform topic suggestion",
      body: draftSections.freeformTopic.body,
      highlights: draftSections.freeformTopic.toneGuidance
        ? [`Tone guidance: ${draftSections.freeformTopic.toneGuidance}`]
        : undefined,
    } satisfies NewsletterSection;
  }, [draftSections]);

  useEffect(() => {
    if (newsletterCopyFeedback.status === "idle" || typeof window === "undefined") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNewsletterCopyFeedback({ status: "idle" });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [newsletterCopyFeedback.status]);

  const handleSectionUpdate = (updatedSection: NewsletterSection | ActionItemsSection) => {
    setDraftSections((previous) => {
      if (!previous) {
        return previous;
      }

      if ("items" in updatedSection && updatedSection.id === previous.actionItems.id) {
        return {
          ...previous,
          actionItems: updatedSection,
        };
      }

      if (updatedSection.id === previous.introduction.id) {
        return {
          ...previous,
          introduction: updatedSection,
        };
      }

      const mainUpdateIndex = previous.mainUpdates.findIndex((section) => section.id === updatedSection.id);
      if (mainUpdateIndex !== -1) {
        const nextMainUpdates = [...previous.mainUpdates];
        nextMainUpdates[mainUpdateIndex] = updatedSection;
        return {
          ...previous,
          mainUpdates: nextMainUpdates,
        };
      }

      if (updatedSection.id === previous.closing.id) {
        return {
          ...previous,
          closing: updatedSection,
        };
      }

      if (updatedSection.id === FREEFORM_SECTION_ID) {
        return {
          ...previous,
          freeformTopic: {
            ...previous.freeformTopic,
            title: updatedSection.title,
            body: updatedSection.body,
          },
        };
      }

      return previous;
    });
  };

  const handleCopyNewsletter = async () => {
    if (!draftSections) {
      setNewsletterCopyFeedback({
        status: "error",
        message: "Generate a newsletter draft before copying.",
      });
      return;
    }

    const newsletterText = buildNewsletterCopy(draftSections, freeformSection);

    if (!newsletterText) {
      setNewsletterCopyFeedback({
        status: "error",
        message: "Nothing to copy yet.",
      });
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(newsletterText);
        setNewsletterCopyFeedback({
          status: "success",
          message: "Newsletter copied to clipboard.",
        });
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (error) {
      console.error("Failed to copy newsletter", error);
      setNewsletterCopyFeedback({
        status: "error",
        message: "Copy failed. Select the text and copy manually.",
      });
    }
  };

  return (
    <main className="newsletter-generator">
      <header>
        <h1>Internal Newsletter Generator</h1>
        <p>
          Upload your meeting assets and provide any additional context. We&apos;ll assemble a draft
          newsletter tailored for internal readers.
        </p>
      </header>

      <form className="newsletter-generator__form" onSubmit={handleSubmit}>
        <fieldset disabled={submissionState === "submitting"}>
          <legend>Meeting audio upload</legend>
          <div className="form-control">
            <label htmlFor="audio-upload">Audio file ({allowedAudioTypesLabel})</label>
            <input
              id="audio-upload"
              type="file"
              accept={SUPPORTED_AUDIO_MIME_TYPES.join(",")}
              onChange={handleAudioChange}
            />
            {formState.audioFile ? (
              <div className="form-hint" role="status">
                Selected file: <strong>{formState.audioFile.name}</strong> ({Math.round(formState.audioFile.size / 1024)} KB)
              </div>
            ) : (
              <p className="form-hint">Optional. MP3 or WAV up to one hour.</p>
            )}
            {renderFieldErrors("audio")}
          </div>

          <div className="form-control">
            <label htmlFor="audio-duration">Audio duration (minutes)</label>
            <input
              id="audio-duration"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 42"
              value={formState.audioDurationMinutes}
              onChange={handleDurationChange}
            />
            <p className="form-hint">Used to ensure uploads stay within the 60 minute limit.</p>
            {audioDurationWarning ? <p className="form-error">{audioDurationWarning}</p> : null}
            {renderFieldErrors("audio.durationSeconds")}
          </div>
        </fieldset>

        <fieldset disabled={submissionState === "submitting"}>
          <legend>Meeting recap</legend>
          <div className="form-control">
            <label htmlFor="meeting-recap">Summary notes</label>
            <textarea
              id="meeting-recap"
              required
              minLength={20}
              rows={8}
              placeholder="Key points from the meeting recap..."
              value={formState.meetingRecap}
              onChange={handleTextChange("meetingRecap")}
            />
            <p className="form-hint">Aim for the decisions, highlights, and context the team should know.</p>
            {renderFieldErrors("meetingRecap")}
          </div>
          <div className="form-control">
            <label htmlFor="recap-author">Recap author (optional)</label>
            <input
              id="recap-author"
              type="text"
              value={formState.recapAuthor}
              onChange={handleTextChange("recapAuthor")}
              placeholder="Name or team"
            />
          </div>
        </fieldset>

        <fieldset disabled={submissionState === "submitting"}>
          <legend>Full transcript</legend>
          <div className="form-control">
            <label htmlFor="transcript-text">Transcript text</label>
            <textarea
              id="transcript-text"
              required
              minLength={50}
              rows={10}
              placeholder="Paste the full meeting transcript here..."
              value={formState.transcript}
              onChange={handleTextChange("transcript")}
            />
            <p className="form-hint">The transcript helps cross-check recap highlights and extract action items.</p>
            {renderFieldErrors("transcript")}
          </div>
          <div className="form-control">
            <label htmlFor="transcript-source">Transcript source (optional)</label>
            <input
              id="transcript-source"
              type="text"
              value={formState.transcriptSource}
              onChange={handleTextChange("transcriptSource")}
              placeholder="e.g. Otter.ai, Zoom"
            />
          </div>
        </fieldset>

        <fieldset disabled={submissionState === "submitting"}>
          <legend>Freeform topic prompt</legend>
          <div className="form-control">
            <label htmlFor="freeform-topic">Topic title (optional)</label>
            <input
              id="freeform-topic"
              type="text"
              maxLength={MAX_FREEFORM_TOPIC_LENGTH}
              value={formState.freeformTopic}
              onChange={handleTextChange("freeformTopic")}
              placeholder="e.g. Team shout-outs"
            />
            <p className="form-hint">Used to seed the optional freeform block in the generated newsletter.</p>
            {renderFieldErrors("freeformTopicPrompt.topic", "freeformTopic")}
          </div>
          <div className="form-control">
            <label htmlFor="freeform-instructions">Tone &amp; guidance (optional)</label>
            <textarea
              id="freeform-instructions"
              maxLength={MAX_FREEFORM_INSTRUCTIONS_LENGTH}
              rows={4}
              value={formState.freeformInstructions}
              onChange={handleTextChange("freeformInstructions")}
              placeholder="Add any tone or detail preferences for the freeform topic..."
            />
            {renderFieldErrors("freeformTopicPrompt.instructions", "freeformInstructions")}
          </div>
        </fieldset>

        <footer className="form-footer">
          <button type="submit" disabled={submissionState === "submitting"}>
            {submissionState === "submitting" ? "Preparing…" : "Generate newsletter"}
          </button>
          <button type="button" onClick={resetForm} disabled={submissionState === "submitting"}>
            Reset form
          </button>
        </footer>
      </form>

      <aside className="newsletter-generator__summary" aria-live="polite">
        <h2>Draft input summary</h2>
        <ul>
          <li>Recap length: {draftSummary.meetingRecapLength} characters</li>
          <li>Transcript length: {draftSummary.transcriptLength} characters</li>
          <li>
            Audio duration: {audioDurationSeconds !== undefined
              ? `${Math.round(audioDurationSeconds / 60)} minutes`
              : "Not provided"}
          </li>
          <li>
            Freeform topic: {formState.freeformTopic ? formState.freeformTopic : "None yet"}
          </li>
        </ul>
        {submissionState === "submitting" ? (
          <p className="form-hint" role="status">
            Processing newsletter draft…
          </p>
        ) : null}
        {statusMessage ? (
          <p className={submissionState === "failed" ? "form-error" : "form-hint"} role="status">
            {statusMessage}
          </p>
        ) : null}
        {newsletterWarnings.length > 0 ? (
          <ul className="form-hint newsletter-generator__warnings" role="status">
            {newsletterWarnings.map((warning, index) => (
              <li key={`warning-${index}`}>{warning}</li>
            ))}
          </ul>
        ) : null}
        {newsletterMetadata ? (
          <p className="form-hint" role="status">
            Draft generated {new Date(newsletterMetadata.createdAt).toLocaleString()}.
            {" "}
            {newsletterMetadata.audioSummaryIncluded
              ? "Audio highlights were included in this draft."
              : "Audio highlights were not included in this draft."}
          </p>
        ) : null}
        {generalErrors.length > 0 ? (
          <ul className="form-error" role="alert">
            {generalErrors.map((error, index) => (
              <li key={`${error.field}-${index}`}>{error.message}</li>
            ))}
          </ul>
        ) : null}
      </aside>

      <section className="newsletter-generator__preview">
        <h2>Draft newsletter preview</h2>
        {draftSections ? (
          <>
            <div className="newsletter-generator__preview-actions">
              <button
                type="button"
                onClick={handleCopyNewsletter}
                disabled={submissionState === "submitting"}
              >
                Copy newsletter
              </button>
              {newsletterCopyFeedback.status === "success" ? (
                <p className="form-hint" role="status">{newsletterCopyFeedback.message}</p>
              ) : null}
              {newsletterCopyFeedback.status === "error" ? (
                <p className="form-error" role="alert">{newsletterCopyFeedback.message}</p>
              ) : null}
            </div>
            <div className="newsletter-generator__preview-sections">
              <NewsletterSectionEditor section={draftSections.introduction} onChange={handleSectionUpdate} />
              {draftSections.mainUpdates.map((section) => (
                <NewsletterSectionEditor key={section.id} section={section} onChange={handleSectionUpdate} />
              ))}
              <NewsletterSectionEditor section={draftSections.actionItems} onChange={handleSectionUpdate} />
              <NewsletterSectionEditor
                section={draftSections.closing}
                onChange={handleSectionUpdate}
              />
              {freeformSection ? (
                <NewsletterSectionEditor
                  section={freeformSection}
                  supportingText={
                    draftSections.freeformTopic.prompt?.topic
                      ? `Prompted by "${draftSections.freeformTopic.prompt.topic}"`
                      : undefined
                  }
                  onChange={handleSectionUpdate}
                />
              ) : null}
            </div>
          </>
        ) : (
          <p className="form-hint">Prepare a draft to review and edit generated newsletter sections.</p>
        )}
      </section>
    </main>
  );
};

export default NewsletterGeneratorPage;


const buildSanitizedFormState = (
  state: FormState,
  payload: NewsletterUploadPayload,
): FormState => {
  const sanitized: FormState = {
    ...state,
    meetingRecap: payload.meetingRecap?.text ?? state.meetingRecap,
    transcript: payload.transcript?.text ?? state.transcript,
    freeformTopic: payload.freeformTopicPrompt?.topic ?? "",
    freeformInstructions: payload.freeformTopicPrompt?.instructions ?? "",
  };

  if (payload.audio?.durationSeconds) {
    sanitized.audioDurationMinutes = formatDurationMinutes(payload.audio.durationSeconds);
  }

  return sanitized;
};

const formatDurationMinutes = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }

  const minutes = seconds / 60;
  const rounded = Math.round(minutes * 10) / 10;
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toString();
};

const formatActionItemForCopy = (item: ActionItem) => {
  const ownerLabel = item.owner ? ` — Owner: ${item.owner}` : "";
  const dueDateLabel = item.dueDate ? ` (Due: ${new Date(item.dueDate).toLocaleDateString()})` : "";
  return `• ${item.summary}${ownerLabel}${dueDateLabel}`;
};

const buildNewsletterCopy = (
  structured: StructuredNewsletter,
  freeformSection?: NewsletterSection,
): string => {
  const sections: NewsletterSection[] = [
    structured.introduction,
    ...structured.mainUpdates,
  ];

  const serializedSections: string[] = [];

  const appendSection = (section: NewsletterSection) => {
    const sectionLines: string[] = [];

    if (section.title?.trim()) {
      sectionLines.push(section.title.trim());
    }

    if (section.body?.trim()) {
      sectionLines.push(section.body.trim());
    }

    if (section.highlights?.length) {
      sectionLines.push(...section.highlights.map((highlight) => `• ${highlight}`));
    }

    if (sectionLines.length > 0) {
      serializedSections.push(sectionLines.join("\n"));
    }
  };

  sections.forEach(appendSection);

  const actionItemLines: string[] = [];

  if (structured.actionItems.title?.trim()) {
    actionItemLines.push(structured.actionItems.title.trim());
  }

  if (structured.actionItems.body?.trim()) {
    actionItemLines.push(structured.actionItems.body.trim());
  }

  if (structured.actionItems.items.length > 0) {
    actionItemLines.push(
      ...structured.actionItems.items.map((item) => formatActionItemForCopy(item)),
    );
  }

  if (actionItemLines.length > 0) {
    serializedSections.push(actionItemLines.join("\n"));
  }

  appendSection(structured.closing);

  const freeformToAppend =
    freeformSection ??
    (structured.freeformTopic
      ? {
          id: FREEFORM_SECTION_ID,
          title:
            structured.freeformTopic.title ||
            structured.freeformTopic.prompt?.topic ||
            "Freeform topic suggestion",
          body: structured.freeformTopic.body,
          highlights: structured.freeformTopic.toneGuidance
            ? [`Tone guidance: ${structured.freeformTopic.toneGuidance}`]
            : undefined,
        }
      : undefined);

  if (freeformToAppend) {
    appendSection(freeformToAppend);
  }

  return serializedSections.join("\n\n").trim();
};
