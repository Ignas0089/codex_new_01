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

## Visual and Interaction Design Guidelines

### General Design Overview
Create a modern B2B productivity tool that feels efficient yet warm. The interface should reduce friction in uploading, summarizing, and previewing newsletters while encouraging frequent use.

#### Core Design Principles
- **Calm Clarity:** Preserve generous whitespace so each surface and control feels intentional and relaxed.
- **Focused Flow:** Reveal only the elements relevant to the current step (upload → processing → preview → export).
- **Friendly Professionalism:** Pair trustworthy copy with human touches—rounded corners, soft shadows, personable helper text.
- **Information Hierarchy:** Separate inputs, generated content, and actions into clearly structured zones.
- **Subtle Delight:** Sprinkle in light animation and microinteractions to keep the workflow from feeling mechanical.

### Color Palette

| Use Case | Token | Hex | Notes |
| --- | --- | --- | --- |
| Primary elements | Dusty Blue | `#4A5A6A` | Headings, primary CTAs, prominent icons |
| Secondary surfaces | Soft Gray | `#F4F5F7` | Section backgrounds, card shells |
| Accent 1 | Warm Coral | `#FF6B6B` | Errors, warning badges, highlight callouts |
| Accent 2 | Soft Green | `#00B894` | Success toasts, confirmation states |
| Base surface | White | `#FFFFFF` | Cards, inputs, modal bodies |
| Elevation | Shadow | `rgba(0, 0, 0, 0.05)` | Card and modal shadows |

Pair accent colors with Dusty Blue typography to preserve contrast, and reserve Warm Coral for moments that truly need attention.

### Typography
- **Primary Typeface:** Inter for all UI copy (400 body, 500 labels, 600 secondary headings, 700 main headings).
- **Supporting Typeface (Optional):** Roboto Mono for transcript blocks or time-stamped details.
- **Scale:** H1 24px, H2 20px, H3 18px, body 16px, labels 14px, button text 14px uppercase with letter spacing.
- Use 24px top and 16px bottom spacing around headings to maintain rhythm across stacked cards.

### Key Screens and Layouts

#### Upload Dashboard
- Two-panel layout: form inputs on the left, live preview on the right.
- Drag-and-drop audio zone with iconography and helper text on supported formats and time limits.
- Accordion cards for meeting recap, transcript, and optional freeform prompt; each card includes field hints and validation messaging.
- Sticky bottom action bar pinned to the viewport with Process, Preview, and Reset buttons.

#### Processing Flow
- Multi-step progress indicator across the top (Upload → Summarize → Assemble → Review).
- Centered status card with animated waveform or pulsing dots in Soft Green to show activity.
- Toast system for success/failure messages using the accent palette.

#### Editor View
- Stack each generated section (Introduction, Main Updates, Action Items, Closing, Freeform Topic) as elevated cards.
- Inline editable rich-text areas with clear labels and helper descriptions.
- Icon buttons for copy, reset to AI suggestion, and delete; tooltips on hover or focus.
- AI-generated copy highlighted with a subtle tint (`#FDF6F2`) and “Generated by AI” badge.

#### Resource Modules (Optional)
- Secondary column or footer carousel for “Tips for Better Recaps,” “Recent Templates,” or archive links.
- Provide quick links to saved newsletters and template switching.

#### Profile & Preferences (Optional)
- Lightweight panel with avatar, name, and toggles for tone defaults, anonymization, and email reminders.

### Mobile UX and Accessibility
- Responsive layout collapses to vertical stacking with sticky bottom navigation (“Upload,” “Recap,” “Transcript,” “Preview”).
- Minimum tap targets of 44px and maintain 24px spacing between cards; internal padding 16px.
- High-contrast text/background combinations to satisfy WCAG AA.
- Custom focus states for keyboard navigation; outline uses Dusty Blue with a 2px stroke.
- Respect reduced-motion preferences by disabling waveform animations and replacing them with gentle fades.

### Icons, Illustrations, and Visual Language
- Use Lucide or Feather icon sets for consistency; size at 20–24px with Dusty Blue color.
- Align icons left of labels in input headers and action bars.
- Employ abstract, softly colored SVG blobs or sketch lines for empty states and onboarding slides.
- Ensure all decorative illustrations are optimized SVGs for crisp rendering.

### Microinteractions and Animations
- Buttons lighten their background (`#E5E9ED`) on hover and scale to 102% on click before easing back.
- Cards elevate from `shadow-sm` to `shadow-md` on hover to signal interactivity.
- Toasts slide in from the right and auto-dismiss after 4 seconds with a manual close option.
- Provide tooltip fade-ins for icon buttons with 150ms transitions.

### Performance Considerations
- Compress illustrations and defer loading of transcript-heavy sections until requested.
- Debounce autosave or sync operations for large text fields and persist recent uploads in local storage.
- Guard against long audio uploads by providing progress feedback and cancelling gracefully on network failures.

### Security and Privacy
- Always present destructive actions (delete upload, clear transcript) with confirmation dialogs.
- Offer anonymization toggles to mask personal names within generated content before copying.
- Clearly display data retention messaging and provide a “Delete transcript” control that purges local caches.

These guidelines ensure the tool evolves from a functional prototype into a polished, trustworthy companion for internal communications teams.

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
