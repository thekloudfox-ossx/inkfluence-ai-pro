import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAI, extractJson, HOUSE_STYLE } from "./ai-gateway.server";

const MetaSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional().default(""),
  author: z.string().optional().default(""),
  topic: z.string(),
  audience: z.string().optional().default(""),
  tone: z.string().optional().default(""),
});

export const generateOutline = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        topic: z.string().min(3),
        audience: z.string().optional().default(""),
        tone: z.string().optional().default(""),
        chapterCount: z.number().min(1).max(30).optional().default(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const raw = await callAI([
      {
        role: "system",
        content: `You are a veteran non-fiction and fiction book architect. ${HOUSE_STYLE}\nReturn strict JSON only.`,
      },
      {
        role: "user",
        content: `Design a book.
Topic: ${data.topic}
Intended reader: ${data.audience || "a smart general reader"}
Voice: ${data.tone || "direct, opinionated, warm"}
Chapters: ${data.chapterCount}

Return JSON exactly like:
{"title":"","subtitle":"","chapters":[{"title":"","summary":"2 sentences on the argument and the concrete examples this chapter uses"}]}
Titles must be specific and un-generic. No colons-plus-buzzword formulas.`,
      },
    ], { json: true });

    return extractJson<{
      title: string;
      subtitle: string;
      chapters: { title: string; summary: string }[];
    }>(raw);
  });

export const writePage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        meta: MetaSchema,
        pageType: z.string(),
        pageTitle: z.string().optional().default(""),
        brief: z.string().optional().default(""),
        outline: z.array(z.string()).optional().default([]),
        words: z.number().min(120).max(4000).optional().default(900),
        existing: z.string().optional().default(""),
        instruction: z.string().optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { meta } = data;
    const context = `Book: "${meta.title}"${meta.subtitle ? ` — ${meta.subtitle}` : ""}
Topic: ${meta.topic}
Reader: ${meta.audience || "a smart general reader"}
Voice: ${meta.tone || "direct, opinionated, warm"}
Full chapter list: ${data.outline.join(" | ") || "n/a"}`;

    const job = data.existing
      ? `Rewrite the draft below. ${data.instruction || "Make it sharper, more specific and more human."}\n\nDRAFT:\n${data.existing}`
      : `Write the "${data.pageType}" page titled "${data.pageTitle}".
What it must cover: ${data.brief || "use your judgement based on the outline"}
${data.instruction ? `Extra instruction: ${data.instruction}` : ""}`;

    return await callAI([
      {
        role: "system",
        content: `You write book manuscript pages that read like a human author wrote them. ${HOUSE_STYLE}\nTarget length: about ${data.words} words. Output the page body only, no title line, no commentary.`,
      },
      { role: "user", content: `${context}\n\n${job}` },
    ]);
  });

export const humanizeText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(20),
        intensity: z.enum(["light", "medium", "heavy"]).optional().default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const dial = {
      light: "Keep it polished. Break up rhythm, kill every em dash and stock phrase.",
      medium:
        "Loosen it noticeably. Add asides, a contraction-heavy voice, one or two sentence fragments, and a personal aside or concrete anecdote.",
      heavy:
        "Rewrite it as spoken-aloud prose. Uneven paragraph lengths, tangents, a mild self-correction, casual asides, an occasional one-word sentence. Slightly imperfect but never sloppy or ungrammatical in a way an editor would flag.",
    }[data.intensity];

    return await callAI([
      {
        role: "system",
        content: `You are a ghostwriter who rewrites machine-sounding drafts so they read like a specific human wrote them. ${HOUSE_STYLE}\n${dial}\nKeep every fact, argument, structure and sub-heading. Do not shorten by more than 10%. Output the rewritten text only.`,
      },
      { role: "user", content: data.text },
    ]);
  });

export const auditText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ text: z.string().min(20) }).parse(input))
  .handler(async ({ data }) => {
    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "You are a manuscript editor auditing a draft for AI-detector tells and for passages that read as if lifted from existing published material. Return strict JSON only.",
        },
        {
          role: "user",
          content: `Audit this draft.
Return JSON exactly:
{"aiLikelihood":0-100,"verdict":"one blunt sentence","tells":[{"quote":"exact phrase from the draft","why":"why it reads as machine written"}],"derivative":[{"quote":"exact phrase","why":"why this looks like generic or borrowed phrasing that should be rewritten from scratch"}],"fixes":["concrete rewrite instruction"]}
Keep each list to at most 6 items. Quote text verbatim from the draft.

DRAFT:
${data.text.slice(0, 24000)}`,
        },
      ],
      { json: true },
    );

    return extractJson<{
      aiLikelihood: number;
      verdict: string;
      tells: { quote: string; why: string }[];
      derivative: { quote: string; why: string }[];
      fixes: string[];
    }>(raw);
  });

export const suggestCoverPrompts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ title: z.string(), topic: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "You art-direct book covers. Return strict JSON only. Each prompt describes a printable front cover illustration: composition, palette, medium, mood. No text or lettering in the artwork.",
        },
        {
          role: "user",
          content: `Book title: "${data.title}". Topic: ${data.topic}.
Return {"prompts":[{"label":"3-word style name","prompt":"one detailed image prompt"}]} with 6 visually distinct directions.`,
        },
      ],
      { json: true },
    );
    return extractJson<{ prompts: { label: string; prompt: string }[] }>(raw);
  });
