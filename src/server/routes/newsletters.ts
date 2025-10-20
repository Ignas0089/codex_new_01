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

    res
      .status(200)
      .json(serializeNewsletterUploadSuccessResponse(validation.payload));
  },
);

export default newslettersRouter;
