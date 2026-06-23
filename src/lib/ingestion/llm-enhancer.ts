import { MarketId } from "@/lib/types";

interface EnhancedTopic {
  angle?: string;
  hook?: string;
  thumbnail_concept?: string;
}

// Only runs if ANTHROPIC_API_KEY is set; degrades gracefully otherwise
export async function enhanceWithLLM(
  title: string,
  summary: string,
  market: MarketId,
): Promise<EnhancedTopic> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return {};

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const marketNames: Record<MarketId, string> = {
      mx: "México",
      cl: "Chile",
      ar: "Argentina",
      co: "Colombia",
      pe: "Perú",
      us_hispanic: "Hispanos en EE.UU.",
      latam: "Latinoamérica",
      global_es: "Audiencia global en español",
    };

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Eres un editor digital experto en medios digitales latinoamericanos.

Noticia: "${title}"
Resumen: "${summary}"
Mercado objetivo: ${marketNames[market]}

Responde en JSON con exactamente estas claves:
{
  "angle": "Ángulo editorial específico para ${marketNames[market]} (máx 120 caracteres)",
  "hook": "Hook de video/artículo que genere clicks (máx 80 caracteres, sin clickbait vacío)",
  "thumbnail_concept": "Descripción visual para thumbnail (máx 80 caracteres)"
}

Solo JSON, sin texto adicional.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text.trim());
    return {
      angle: parsed.angle || undefined,
      hook: parsed.hook || undefined,
      thumbnail_concept: parsed.thumbnail_concept || undefined,
    };
  } catch {
    // Graceful degradation: LLM unavailable or quota exceeded
    return {};
  }
}
