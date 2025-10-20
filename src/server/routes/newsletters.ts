import type { NextFunction, Request, Response } from "express";
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
import type { ValidationErrorDetail } from "../../types/newsletter";

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
  async (req: MulterRequest, res: Response): Promise<void> => {
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

newslettersRouter.use(
  (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (!(error instanceof multer.MulterError)) {
      next(error);
      return;
    }

    const errorDetail = mapMulterErrorToValidationError(error);
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    res.status(status).json(serializeNewsletterUploadErrorResponse([errorDetail]));
  },
);

export default newslettersRouter;

const mapMulterErrorToValidationError = (error: multer.MulterError): ValidationErrorDetail => {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      return {
        field: "audio",
        message: "Audio file exceeds the 200MB size limit.",
        code: "LIMIT_EXCEEDED",
      };
    case "LIMIT_FILE_COUNT":
    case "LIMIT_PART_COUNT":
      return {
        field: "audio",
        message: "Only a single audio file can be uploaded per request.",
        code: "LIMIT_EXCEEDED",
      };
    case "LIMIT_UNEXPECTED_FILE":
      return {
        field: "audio",
        message: "Unexpected file upload received. Please attach a valid audio file.",
        code: "INVALID_FORMAT",
      };
    case "LIMIT_FIELD_KEY":
    case "LIMIT_FIELD_VALUE":
    case "LIMIT_FIELD_COUNT":
      return {
        field: "form",
        message: "Submitted form fields exceeded the allowed limits. Please try again.",
        code: "INVALID_FORMAT",
      };
    default:
      return {
        field: "form",
        message: "Unable to process the uploaded file. Please try again.",
      };
  }
};
