import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../../lib/db";
import { sets, cards } from "../../../lib/db/schema";
import { authMiddleware } from "../auth/actions";

const CardSchema = z.object({
  term: z.string().min(1).max(500),
  definition: z.string().max(2000).default(""),
});

const CreateSetSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  subject: z.string().max(100).default(""),
  cover: z.string().max(64).optional(),
  cards: z.array(CardSchema).min(1),
});

export const createSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => CreateSetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { title, description, subject, cover, cards: inputCards } = data;
    const userId = context.user.id;
    const id = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(sets).values({
        id,
        userId,
        title,
        description,
        subject,
        ...(cover ? { cover } : {}),
      });
      for (let i = 0; i < inputCards.length; i++) {
        const card = inputCards[i];
        await tx.insert(cards).values({
          id: crypto.randomUUID(),
          setId: id,
          term: card.term,
          definition: card.definition,
          position: i,
        });
      }
    });

    return { id };
  });

const UpdateSetSchema = z.object({
  setId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  subject: z.string().max(100).default(""),
  cards: z.array(CardSchema).min(1),
});

export const updateSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => UpdateSetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { setId, title, description, subject, cards: inputCards } = data;
    const userId = context.user.id;

    const [existing] = await db
      .select()
      .from(sets)
      .where(and(eq(sets.id, setId), eq(sets.userId, userId)))
      .limit(1);
    if (!existing) throw new Error("Not found");

    await db.transaction(async (tx) => {
      await tx
        .update(sets)
        .set({ title, description, subject, updatedAt: new Date() })
        .where(eq(sets.id, setId));
      await tx.delete(cards).where(eq(cards.setId, setId));
      for (let i = 0; i < inputCards.length; i++) {
        const card = inputCards[i];
        await tx.insert(cards).values({
          id: crypto.randomUUID(),
          setId,
          term: card.term,
          definition: card.definition,
          position: i,
        });
      }
    });

    return { ok: true };
  });

const DeleteSetSchema = z.object({
  setId: z.string().min(1),
});

export const deleteSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => DeleteSetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { setId } = data;
    const userId = context.user.id;

    const [existing] = await db
      .select()
      .from(sets)
      .where(and(eq(sets.id, setId), eq(sets.userId, userId)))
      .limit(1);
    if (!existing) throw new Error("Not found");

    await db.delete(sets).where(eq(sets.id, setId));

    return { ok: true };
  });

const UpdateVisibilitySchema = z.object({
  setId: z.string().min(1),
  visibility: z.enum(["private", "public"]),
});

export const updateSetVisibility = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => UpdateVisibilitySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { setId, visibility } = data;
    const userId = context.user.id;

    const [existing] = await db
      .select()
      .from(sets)
      .where(and(eq(sets.id, setId), eq(sets.userId, userId)))
      .limit(1);
    if (!existing) throw new Error("Not found");

    await db
      .update(sets)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(sets.id, setId));

    return { ok: true };
  });

const UpdateCoverSchema = z.object({
  setId: z.string().min(1),
  /** cover|icon format e.g. "default|book-open" or "solid:#4255ff|brain" */
  cover: z.string().min(1).max(64),
});

export const updateSetCover = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => UpdateCoverSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { setId, cover } = data;
    const userId = context.user.id;

    await db
      .update(sets)
      .set({ cover, updatedAt: new Date() })
      .where(and(eq(sets.id, setId), eq(sets.userId, userId)));

    return { ok: true };
  });

const GenerateAICardsSchema = z.object({
  notes: z.string().min(1),
});

export const generateAICards = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => GenerateAICardsSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("AI generation is not enabled on this server");
    }

    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

    const systemPrompt = `You are a flashcard generator. Convert notes into term/definition pairs.
Return ONLY a JSON array of objects with "term" and "definition" fields.
One concept per card. Precise and concise.`;

    try {
      const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${cleanBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: model.trim(),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: data.notes },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            `AI service returned error: ${res.statusText}`,
        );
      }

      const resJson = await res.json();
      const text = resJson.choices?.[0]?.message?.content || "";
      const cards = JSON.parse(
        text
          .replace(/```json\s*/gi, "")
          .replace(/```\s*$/gm, "")
          .trim(),
      );

      if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error("No cards generated");
      }
      return cards as { term: string; definition: string }[];
    } catch (e: unknown) {
      throw new Error(
        e instanceof Error
          ? e.message
          : "Failed to parse AI response into flashcards. Try again or check your input.",
        { cause: e }
      );
    }
  });

export const checkAIGeneratorStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    return {
      enabled: !!(process.env.OPENAI_API_KEY || "").trim(),
    };
  });
