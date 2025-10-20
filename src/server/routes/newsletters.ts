import type { Request, Response } from "express";
import { Router } from "express";
import multer from "multer";

import { validateNewsletterUpload } from "../../services/validation/newsletterUploadValidator";

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

type MulterFields = {
  meetingRecapText?: string;
  transcriptText?: string;
  freeformTopic?: string;
  freeformInstructions?: string;
  audioDurationSeconds?: string | number;
};

const coerceString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return String(value);
};

const coerceNumber = (value: unknown): number | undefined => {
  const stringValue = coerceString(value);
  if (!stringValue) {
    return undefined;
  }

  const parsed = Number(stringValue);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildValidationContext = (
  req: MulterRequest,
  fields: MulterFields,
) => ({
  audioFile: req.file
    ? {
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
      }
    : undefined,
  body: {
    meetingRecapText: coerceString(fields.meetingRecapText),
    transcriptText: coerceString(fields.transcriptText),
    freeformTopic: coerceString(fields.freeformTopic),
    freeformInstructions: coerceString(fields.freeformInstructions),
    audioDurationSeconds: coerceNumber(fields.audioDurationSeconds),
  },
});

const newslettersRouter = Router();

newslettersRouter.post(
  "/newsletters",
  upload.single("audio"),
  (req: MulterRequest, res: Response): void => {
    const fields = req.body as MulterFields;

    const validation = validateNewsletterUpload(buildValidationContext(req, fields));

    if (!validation.isValid || !validation.payload) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    res.status(200).json({
      message: "Upload validated.",
      payload: validation.payload,
    });
  },
);

export default newslettersRouter;
