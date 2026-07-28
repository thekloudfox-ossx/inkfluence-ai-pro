export async function streamImage(
  url: string,
  prompt: string,
  onFrame: (dataUrl: string, final: boolean) => void,
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) throw new Error((await res.text()) || "Image generation failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          b64_json?: string;
          data?: { b64_json?: string }[];
        };
        const b64 = event.b64_json ?? event.data?.[0]?.b64_json;
        if (b64) {
          const final = event.type ? event.type.endsWith("completed") : true;
          onFrame(`data:image/png;base64,${b64}`, final);
        }
      } catch {
        // ignore malformed frames
      }
    }
  }
}
