import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../../../lib/db";
import { studySessions } from "../../../lib/db/schema";
import { authMiddleware } from "../auth/actions";

const SaveStudySessionSchema = z.object({
  setId: z.string().min(1),
  mode: z.string().min(1),
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const saveStudySession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => SaveStudySessionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { setId, mode, correct, total } = data;
    await db.insert(studySessions).values({
      id: crypto.randomUUID(),
      userId: context.user.id,
      setId,
      mode,
      correctCards: correct,
      totalCards: total,
      score: total > 0 ? correct / total : 0,
    });

    return { ok: true };
  });
