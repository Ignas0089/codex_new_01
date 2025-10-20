import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ActionItem,
  ActionItemsSection,
  NewsletterSection,
} from "../../types/newsletter";

type EditableSection = NewsletterSection | ActionItemsSection;

const isActionItemsSection = (
  section: EditableSection
): section is ActionItemsSection =>
  (section as ActionItemsSection).items !== undefined;

interface NewsletterSectionEditorProps {
  section: EditableSection;
  /**
   * Optional descriptive text displayed under the heading. Useful for
   * highlighting tone guidance or AI confidence notes.
   */
  supportingText?: string;
  /**
   * Invoked when the caller wants to persist edits to the structured
   * newsletter state.
   */
  onChange?: (updated: EditableSection) => void;
}

interface CopyFeedback {
  status: "idle" | "success" | "error";
  message?: string;
}

const formatActionItem = (item: ActionItem) => {
  const ownerLabel = item.owner ? ` — Owner: ${item.owner}` : "";
  const dueDateLabel = item.dueDate ? ` (Due: ${new Date(item.dueDate).toLocaleDateString()})` : "";
  return `• ${item.summary}${ownerLabel}${dueDateLabel}`;
};

const buildCopyPayload = (section: EditableSection, title: string, body: string, items?: ActionItem[]) => {
  const lines = [title.trim(), body.trim()].filter(Boolean);
  if (isActionItemsSection(section)) {
    const serializedItems = (items ?? section.items).map(formatActionItem);
    lines.push("", ...serializedItems);
  }
  return lines.join("\n").trim();
};

export const NewsletterSectionEditor: React.FC<NewsletterSectionEditorProps> = ({
  section,
  supportingText,
  onChange,
}) => {
  const [draftTitle, setDraftTitle] = useState(section.title);
  const [draftBody, setDraftBody] = useState(section.body);
  const [draftItems, setDraftItems] = useState<ActionItem[]>(
    isActionItemsSection(section)
      ? section.items.map((item) => ({ ...item }))
      : []
  );
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>({ status: "idle" });

  useEffect(() => {
    setDraftTitle(section.title);
  }, [section.title]);

  useEffect(() => {
    setDraftBody(section.body);
  }, [section.body]);

  useEffect(() => {
    if (isActionItemsSection(section)) {
      setDraftItems(section.items.map((item) => ({ ...item })));
    }
  }, [section]);

  const hasUnsavedChanges = useMemo(() => {
    const titleChanged = draftTitle !== section.title;
    const bodyChanged = draftBody !== section.body;

    if (!isActionItemsSection(section)) {
      return titleChanged || bodyChanged;
    }

    const itemsChanged = draftItems.some((item, index) => {
      const original = section.items[index];
      return !original || item.summary !== original.summary;
    });

    return titleChanged || bodyChanged || itemsChanged;
  }, [draftBody, draftItems, draftTitle, section]);

  useEffect(() => {
    if (copyFeedback.status === "idle" || typeof window === "undefined") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyFeedback({ status: "idle" });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [copyFeedback.status]);

  const handleItemChange = (index: number) => (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.currentTarget;
    setDraftItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              summary: value,
            }
          : item
      )
    );
  };

  const handleSave = () => {
    if (!onChange) {
      return;
    }

    if (isActionItemsSection(section)) {
      onChange({
        ...section,
        title: draftTitle,
        body: draftBody,
        items: draftItems.map((item, index) => ({
          ...section.items[index],
          ...item,
        })),
      });
      return;
    }

    onChange({
      ...section,
      title: draftTitle,
      body: draftBody,
    });
  };

  const handleReset = () => {
    setDraftTitle(section.title);
    setDraftBody(section.body);
    if (isActionItemsSection(section)) {
      setDraftItems(section.items.map((item) => ({ ...item })));
    }
  };

  const handleCopy = async () => {
    const payload = buildCopyPayload(section, draftTitle, draftBody, draftItems);

    if (!payload) {
      setCopyFeedback({ status: "error", message: "Nothing to copy yet." });
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopyFeedback({ status: "success", message: "Section copied." });
    } catch (error) {
      console.error("Failed to copy newsletter section", error);
      setCopyFeedback({
        status: "error",
        message: "Copy failed. Select the text and copy manually.",
      });
    }
  };

  return (
    <section className="newsletter-section-editor" aria-live="polite">
      <header className="newsletter-section-editor__header">
        <h3>{draftTitle}</h3>
        {supportingText ? <p className="newsletter-section-editor__supporting">{supportingText}</p> : null}
        {hasUnsavedChanges ? (
          <p className="newsletter-section-editor__status" role="status">
            Unsaved changes
          </p>
        ) : null}
      </header>

      <div className="newsletter-section-editor__field">
        <label htmlFor={`${section.id}-title`}>Section title</label>
        <input
          id={`${section.id}-title`}
          type="text"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.currentTarget.value)}
        />
      </div>

      <div className="newsletter-section-editor__field">
        <label htmlFor={`${section.id}-body`}>Section body</label>
        <textarea
          id={`${section.id}-body`}
          rows={6}
          value={draftBody}
          onChange={(event) => setDraftBody(event.currentTarget.value)}
        />
      </div>

      {isActionItemsSection(section) ? (
        <div className="newsletter-section-editor__action-items">
          <h4>Action items</h4>
          {draftItems.map((item, index) => (
            <div className="newsletter-section-editor__field" key={item.id}>
              <label htmlFor={`${section.id}-item-${item.id}`}>Item {index + 1}</label>
              <textarea
                id={`${section.id}-item-${item.id}`}
                rows={3}
                value={item.summary}
                onChange={handleItemChange(index)}
              />
              <p className="newsletter-section-editor__item-meta">
                {item.owner ? `Owner: ${item.owner}` : "No owner provided"}
                {item.dueDate ? ` • Due ${new Date(item.dueDate).toLocaleDateString()}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {section.highlights && section.highlights.length > 0 ? (
        <div className="newsletter-section-editor__highlights">
          <h4>Highlights</h4>
          <ul>
            {section.highlights.map((highlight, index) => (
              <li key={`${section.id}-highlight-${index}`}>{highlight}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="newsletter-section-editor__footer">
        <button type="button" onClick={handleSave} disabled={!hasUnsavedChanges}>
          Save edits
        </button>
        <button type="button" onClick={handleReset} disabled={!hasUnsavedChanges}>
          Reset
        </button>
        <button type="button" onClick={handleCopy}>
          Copy section
        </button>
        {copyFeedback.status !== "idle" && copyFeedback.message ? (
          <span
            className={`newsletter-section-editor__copy-feedback newsletter-section-editor__copy-feedback--${copyFeedback.status}`}
            role="status"
          >
            {copyFeedback.message}
          </span>
        ) : null}
      </footer>
    </section>
  );
};

export default NewsletterSectionEditor;
