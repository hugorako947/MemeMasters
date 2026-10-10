import { z } from "zod";
import { emailSchema } from "./auth";

export const CONTACT_CATEGORIES = ["question", "bug", "purchase", "report", "account", "other"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 2000;

export const CONTACT_SUBJECT_MIN = 3;
export const CONTACT_SUBJECT_MAX = 80;

export const contactSchema = z
  .object({
    email: emailSchema,
    category: z.enum(CONTACT_CATEGORIES),
    /** Obligatoire quand le sujet est « Autre » : le joueur précise de quoi il s'agit. */
    subject: z.string().trim().max(CONTACT_SUBJECT_MAX).optional(),
    message: z.string().trim().min(CONTACT_MESSAGE_MIN).max(CONTACT_MESSAGE_MAX),
    /** Champ piège invisible : un humain le laisse vide, un robot le remplit. */
    website: z.string().max(0).optional(),
  })
  .refine((d) => d.category !== "other" || (d.subject?.length ?? 0) >= CONTACT_SUBJECT_MIN, { path: ["subject"] });
