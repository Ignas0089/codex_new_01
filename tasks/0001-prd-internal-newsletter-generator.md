# Internal Newsletter Generator PRD

## Introduction / Overview
The internal newsletter generator will help the team assemble a polished newsletter for company employees. Users will upload an audio recap of a meeting, provide the written meeting recap and full meeting transcript, and optionally supply a topic for an additional freeform section. The system will synthesize these inputs into a structured newsletter that minimizes manual editing time while preserving essential updates for the internal audience.

## Goals
- Produce a ready-to-share internal newsletter with minimal manual editing required.
- Structure the output into a clear flow: Introduction, Main Updates, Action Items, and Closing.
- Automatically summarize uploaded meeting materials into concise sections tailored to internal stakeholders.
- Offer an AI-suggested freeform topic section that users can edit before finalizing.

## User Stories
1. As a communications specialist, I want to upload an audio meeting recap so the system can incorporate verbal highlights into the newsletter.
2. As a team lead, I want to paste a written meeting recap and transcript so the generator can cross-reference accurate details.
3. As a content editor, I want the system to auto-generate structured newsletter sections so I do not have to manually outline every update.
4. As a contributor, I want an AI-suggested freeform topic block that I can tweak, ensuring additional themes are well-written without starting from scratch.
5. As an employee reader, I want the newsletter to focus on actionable internal updates so I can stay informed quickly.

## Functional Requirements
1. The system must allow users to upload audio files in MP3 or WAV format up to 60 minutes in length.
2. The system must accept a text-based meeting recap input.
3. The system must accept a full meeting transcript input (text).
4. The system must process the audio file to extract summarized highlights for use in the newsletter.
5. The system must combine insights from the audio, recap, and transcript to produce newsletter content organized into Introduction, Main Updates, Action Items, and Closing sections.
6. The system must surface key decisions, action items, and relevant context in the Main Updates and Action Items sections.
7. The system must generate a Closing section that reinforces next steps or acknowledges contributors.
8. The system must generate an additional freeform topic section by suggesting AI-composed copy based on a user-provided topic prompt, allowing the user to edit the suggested text before finalization.
9. The system must provide a preview interface where the user can review and edit the generated newsletter sections prior to export.
10. The system must support copying the final newsletter text for manual distribution.

## Non-Goals (Out of Scope)
- Integrations with email marketing platforms or automated distribution.
- Rich text formatting tools, WYSIWYG editors, or embedded media beyond plain text editing.
- Automatic transcription of audio files beyond summarizing content (assumes transcript is provided separately).
- User roles, authentication systems, or permission hierarchies.

## Design Considerations
- Provide a clean, text-first interface optimized for reviewing and editing generated sections.
- Clearly delineate each newsletter section (Introduction, Main Updates, Action Items, Closing, Freeform Topic) for easy editing.

## Technical Considerations
- Audio summarization should respect the 60-minute limit and handle large uploads efficiently.
- Ensure text inputs support sufficient length for full transcripts (potentially long-form content).
- Maintain a change history or undo functionality within the editing interface, if feasible, to support quick revisions.

## Success Metrics
- Reduce manual editing time so that 90% of generated newsletters require only minor tweaks (<10 minutes of editing).
- Achieve high user satisfaction (≥4/5) for internal stakeholders regarding clarity and completeness.
- Successfully generate structured newsletters for at least 95% of meeting uploads without processing errors.

## Open Questions
- Should the system provide templates or tone options for different meeting types (e.g., leadership vs. project teams)?
- Are there specific compliance or privacy considerations for handling internal meeting transcripts?
- Is an internal style guide available to tune the tone of generated copy?
