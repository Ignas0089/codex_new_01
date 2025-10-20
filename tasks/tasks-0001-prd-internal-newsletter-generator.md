## Relevant Files

- `src/types/newsletter.ts` - Shared TypeScript interfaces for newsletter inputs, generated sections, and AI suggestions.
- `src/services/audioSummarizer.ts` - Audio processing utilities to validate uploads and extract highlight summaries from MP3/WAV files.
- `src/services/transcriptSynthesizer.ts` - Logic that merges transcript and recap text, aligns it with audio highlights, and surfaces key decisions/action items.
- `src/services/freeformTopicGenerator.ts` - AI helper that generates editable copy for the optional freeform topic block.
- `src/services/newsletterAssembler.ts` - Orchestrator that combines all processed inputs into the Introduction/Main Updates/Action Items/Closing structure.
- `src/server/routes/newsletters.ts` - API route to accept uploads, trigger processing pipeline, and return generated sections.
- `src/ui/pages/NewsletterGeneratorPage.tsx` - Main UI for uploading assets, previewing generated sections, and editing content before copying.
- `src/ui/components/NewsletterSectionEditor.tsx` - Section-level editor component that supports inline editing, change tracking, and copy-to-clipboard controls.
- `tests/services/audioSummarizer.test.ts` - Unit tests covering audio validation and summarization edge cases.
- `tests/services/newsletterAssembler.test.ts` - Unit tests verifying structured section output and action item extraction.
- `tests/ui/NewsletterGeneratorPage.test.tsx` - Component/integration tests for the end-to-end newsletter generation flow.

### Notes

- Ensure uploads reject unsupported formats and audio longer than 60 minutes before processing.
- Summaries should emphasize internal relevance (decisions, next steps) and keep each section concise to reduce manual editing.
- Provide clear UI affordances (section headers, edit indicators, copy button) to reinforce the structured flow.

## Tasks

- [ ] 1.0 Establish backend contracts and validation
  - [x] 1.1 Define newsletter domain types for inputs, generated sections, and freeform suggestions in `src/types/newsletter.ts`.
  - [x] 1.2 Implement upload/validation logic in the newsletters route to accept MP3/WAV files up to 60 minutes, meeting recap text, and transcript text. (Validator helper created in `src/services/validation/newsletterUploadValidator.ts`.)
  - [x] 1.3 Add request/response schemas (e.g., Zod or similar) to enforce payload shape and surface helpful validation errors to the UI.

- [ ] 2.0 Implement audio and text summarization services
  - [ ] 2.1 Build `audioSummarizer` to extract concise highlight snippets from the uploaded audio while respecting size limits and handling failure cases.
  - [ ] 2.2 Create `transcriptSynthesizer` helpers that align transcript + written recap content, pulling out decisions, context, and action items.
  - [ ] 2.3 Write unit tests for both services to cover typical meetings, long transcripts, and invalid inputs.

- [ ] 3.0 Assemble structured newsletter output
  - [ ] 3.1 Implement `newsletterAssembler` orchestrator that merges audio highlights and synthesized text into the Introduction/Main Updates/Action Items/Closing sections.
  - [ ] 3.2 Ensure action items are formatted as bullet lists and include owners/deadlines when available in the source content.
  - [ ] 3.3 Add tests validating section ordering, fallback behavior when an input is missing, and overall response shape.

- [ ] 4.0 Generate and refine freeform topic suggestions
  - [ ] 4.1 Implement `freeformTopicGenerator` that accepts an optional user prompt and produces editable AI copy with tone guidance for internal readers.
  - [ ] 4.2 Integrate the generator into the assembler so the response always includes a suggested freeform section with metadata for edits.
  - [ ] 4.3 Cover edge cases in unit tests (missing prompt, short prompt, need for tone reminders).

- [ ] 5.0 Build the user interface for upload, preview, and editing
  - [ ] 5.1 Create `NewsletterGeneratorPage` with inputs for audio upload, recap text, transcript text, and optional freeform topic prompt.
  - [ ] 5.2 Add `NewsletterSectionEditor` components that display each generated section, allow inline edits, track unsaved changes, and offer copy-to-clipboard.
  - [ ] 5.3 Connect the UI to the backend API, surface processing states/errors, and provide a final "Copy newsletter" control.
  - [ ] 5.4 Author integration/component tests to verify a successful generation flow and ensure validation errors appear as expected.
