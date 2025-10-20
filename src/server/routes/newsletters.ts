import type { Request, Response } from "express";
import { Router } from "express";
import multer from "multer";

import {
  validateNewsletterUpload,
  type UploadedFileDescriptor,
} from "../../services/validation/newsletterUploadValidator";
import {
  parseNewsletterUploadRequest,
  serializeNewsletterUploadErrorResponse,
  serializeNewsletterUploadSuccessResponse,
} from "../../services/validation/newsletterSchemas";
import { assembleNewsletter } from "../../services/newsletterAssembler";
import {
  summarizeMeetingAudio,
  createDefaultAudioSummarizerDependencies,
} from "../../services/audioSummarizer";
import {
  synthesizeMeetingContent,
  createDefaultTranscriptSynthesizerDependencies,
} from "../../services/transcriptSynthesizer";
import { createDefaultFreeformTopicGenerator } from "../../services/freeformTopicGenerator";

const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024; // Keep in sync with validator guard rail

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

type MulterRequest = Request & {
  file?: Express.Multer.File;
};

const toUploadedFileDescriptor = (
  file: Express.Multer.File,
): UploadedFileDescriptor => ({
  mimetype: file.mimetype,
  originalname: file.originalname,
  size: file.size,
  buffer: file.buffer ? new Uint8Array(file.buffer) : undefined,
});

const newslettersRouter = Router();

newslettersRouter.post(
  "/newsletters",
  upload.single("audio"),
  (req: MulterRequest, res: Response): void => {
    const parseResult = parseNewsletterUploadRequest(
      req.body,
      req.file ? toUploadedFileDescriptor(req.file) : undefined,
    );

    if (!parseResult.success) {
      res.status(400).json(serializeNewsletterUploadErrorResponse(parseResult.errors));
      return;
    }

    const validation = validateNewsletterUpload(parseResult.data);

    if (!validation.isValid || !validation.payload) {
      res.status(400).json(serializeNewsletterUploadErrorResponse(validation.errors));
      return;
    }

    const audioData = req.file?.buffer ? Uint8Array.from(req.file.buffer) : undefined;

    try {
      const audioDependencies = createDefaultAudioSummarizerDependencies();
      const transcriptDependencies = createDefaultTranscriptSynthesizerDependencies();
      const generateFreeformTopic = createDefaultFreeformTopicGenerator();

      const newsletter = await assembleNewsletter({
        request: validation.payload,
        audioData,
        dependencies: {
          summarizeAudio: validation.payload.audio
            ? (params) =>
                summarizeMeetingAudio({
                  ...params,
                  dependencies: audioDependencies,
                })
            : undefined,
          synthesizeContent: (params) =>
            synthesizeMeetingContent({
              ...params,
              dependencies: transcriptDependencies,
            }),
          generateFreeformTopic,
        },
      });

      res
        .status(200)
        .json(serializeNewsletterUploadSuccessResponse(validation.payload, newsletter));
    } catch (error) {
      console.error("Failed to assemble newsletter", error);
      res.status(500).json(
        serializeNewsletterUploadErrorResponse([
          {
            field: "form",
            message: "Unable to assemble newsletter content. Please try again.",
          },
        ]),
      );
    }
  },
);

export default newslettersRouter;
