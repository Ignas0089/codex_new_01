import React, { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  MAX_AUDIO_DURATION_SECONDS,
  SUPPORTED_AUDIO_MIME_TYPES,
} from "../../types/newsletter";

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
 * NewsletterGeneratorPage collects all user provided inputs
 * required for generating an internal team newsletter. It focuses on
 * capturing the upload, written context, and optional freeform prompts.
 *
 * API integration and preview rendering will be introduced in later tasks.
 */
export const NewsletterGeneratorPage: React.FC = () => {
  const [formState, setFormState] = useState<FormState>(initialState);
  const [hasSubmittedDraft, setHasSubmittedDraft] = useState(false);

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

  const resetForm = () => {
    setFormState(initialState);
    setHasSubmittedDraft(false);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmittedDraft(true);
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
        <fieldset>
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
          </div>
        </fieldset>

        <fieldset>
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

        <fieldset>
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

        <fieldset>
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
          </div>
        </fieldset>

        <footer className="form-footer">
          <button type="submit">Prepare draft</button>
          <button type="button" onClick={resetForm}>
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
        {hasSubmittedDraft && (
          <p className="form-hint">
            Draft prepared. Backend submission and preview will be available after the integration step.
          </p>
        )}
      </aside>
    </main>
  );
};

export default NewsletterGeneratorPage;
