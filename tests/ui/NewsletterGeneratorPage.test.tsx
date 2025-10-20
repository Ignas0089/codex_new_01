import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NewsletterGeneratorPage } from "../../src/ui/pages/NewsletterGeneratorPage";

describe("NewsletterGeneratorPage", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.resetAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as Record<string, unknown>).fetch;
    }
  });

  const fillRequiredFields = async () => {
    const user = userEvent.setup();

    const recapField = screen.getByLabelText(/summary notes/i);
    await user.type(
      recapField,
      "Discussed roadmap updates and captured three action items."
    );

    const transcriptField = screen.getByLabelText(/transcript text/i);
    await user.type(
      transcriptField,
      [
        "Alice opened the meeting with product launch updates.",
        "The team agreed to run a beta program next sprint.",
        "We captured follow-up tasks for support and marketing.",
      ].join(" ")
    );

    const topicField = screen.getByLabelText(/topic title/i);
    await user.type(topicField, "Team celebrations");

    const instructionsField = screen.getByLabelText(/tone & guidance/i);
    await user.type(instructionsField, "Keep it upbeat and focused on team wins.");

    return { user };
  };

  it("submits newsletter inputs and renders preview sections on success", async () => {
    const fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock;

    const json = jest.fn().mockResolvedValue({
      message: "Upload processed successfully.",
      payload: {
        audio: { durationSeconds: 1200, filename: "meeting.mp3", mimeType: "audio/mpeg" },
        meetingRecap: {
          text: "Roadmap review with next steps captured in detail.",
        },
        transcript: {
          text: "Roadmap review transcript with highlights and follow-ups.",
        },
        freeformTopicPrompt: {
          topic: "Team Spotlight",
          instructions: "Celebrate the latest team achievements.",
        },
      },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json,
    });

    render(<NewsletterGeneratorPage />);

    const { user } = await fillRequiredFields();

    const submitButton = screen.getByRole("button", { name: /generate newsletter/i });

    await user.click(submitButton);

    await waitFor(() => expect(submitButton).toHaveTextContent("Preparing…"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/newsletters",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );

    const introductionHeading = await screen.findByRole("heading", {
      level: 3,
      name: "Introduction",
    });
    expect(introductionHeading).toBeInTheDocument();

    expect(await screen.findByText("Upload processed successfully.")).toBeInTheDocument();
    expect(screen.getByText('Audio duration: 20 minutes')).toBeInTheDocument();

    const freeformSupporting = screen.getByText('Prompted by "Team Spotlight"');
    expect(freeformSupporting).toBeInTheDocument();

    const freeformEditor = freeformSupporting.closest("section");
    expect(freeformEditor).not.toBeNull();

    if (freeformEditor) {
      const sectionScope = within(freeformEditor);
      expect(sectionScope.getByLabelText(/Section title/i)).toHaveValue("Team Spotlight");
    }

    await waitFor(() => expect(submitButton).not.toBeDisabled());
    expect(submitButton).toHaveTextContent("Generate newsletter");
  });

  it("surfaces field and general errors when the server rejects the upload", async () => {
    const fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock;

    const json = jest.fn().mockResolvedValue({
      errors: [
        { field: "meetingRecap", message: "Meeting recap is required." },
        { field: "form", message: "Please review the highlighted fields." },
      ],
    });

    fetchMock.mockResolvedValue({
      ok: false,
      json,
    });

    render(<NewsletterGeneratorPage />);

    const { user } = await fillRequiredFields();

    const submitButton = screen.getByRole("button", { name: /generate newsletter/i });
    await user.click(submitButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByText("We couldn’t process the upload. Please review the highlighted fields.")
    ).toBeInTheDocument();

    expect(await screen.findByText("Meeting recap is required.")).toBeInTheDocument();

    const errorList = screen.getByRole("alert");
    expect(within(errorList).getByText("Please review the highlighted fields.")).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        level: 3,
        name: "Introduction",
      })
    ).not.toBeInTheDocument();

    expect(submitButton).not.toBeDisabled();
  });
});
