const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AIMessage = { role: "system" | "user"; content: string };

export async function callAI(
  messages: AIMessage[],
  opts: { model?: string; json?: boolean } = {},
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3.6-flash",
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (res.status === 429) throw new Error("Rate limited by the AI gateway. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep generating.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("The model returned an empty response.");
  return text;
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

/**
 * House style rules shared by every writing call. These exist specifically to
 * avoid the "obviously machine written" tells: em dashes, stock transitions,
 * uniform sentence length, and hedging filler.
 */
export const HOUSE_STYLE = `Writing rules (non-negotiable):
- Never use em dashes (—) or en dashes in prose. Use commas, periods, or parentheses.
- Vary sentence length hard. Mix 4-word sentences with 30-word ones. Never write three sentences of similar length in a row.
- Ban these words and phrases: delve, tapestry, testament, landscape of, navigate the, unlock, harness, in today's fast-paced world, it's important to note, moreover, furthermore, in conclusion, game-changer, robust, seamless, elevate, embark, realm.
- No bullet-point-shaped paragraphs. Write real prose with opinions, concrete examples, named specifics, and numbers.
- Take a position. Disagree with common advice at least once per chapter.
- Occasional sentence fragments are fine. Start some sentences with And or But.
- Write everything in original words. Never reproduce phrasing from known published books or articles. Paraphrase ideas from first principles and attribute any factual claim in plain language.
- Plain text output only. Use blank lines between paragraphs. Use "## " only for sub-headings inside a page.`;
