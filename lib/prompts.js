// Platform character limits used for validation before showing output.
export const PLATFORM_LIMITS = {
  meta: { headline: 40, body: 125 },
  google: { headline: 30, body: 90 },
  instagram: { headline: 40, body: 125 },
};

export function buildAdCopyPrompt({ product, audience, tone, platform }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.meta;

  const system = `You are a senior direct-response copywriter. You write ad copy that follows
platform character limits exactly, never makes false or unverifiable claims, and always
includes a clear call to action. You return ONLY valid JSON, no prose, no markdown fences.`;

  const user = `Write ad copy for this offer.

Product/offer: ${product}
Target audience: ${audience}
Tone: ${tone}
Platform: ${platform}
Hard limits: headline <= ${limits.headline} characters, body <= ${limits.body} characters.

Return exactly 5 distinct variations as a JSON array. Each item must have this shape:
{ "headline": string, "body": string, "cta": string }

Vary the angle across the 5 (e.g. pain point, social proof, urgency, benefit-led, curiosity).
Return ONLY the JSON array, nothing else.`;

  return { system, user };
}

export function buildSeoMetaPrompt({ pageContent, keyword }) {
  const system = `You are an SEO specialist. You write meta titles and descriptions that follow
Google's practical length guidance, include the target keyword naturally (never stuffed),
and accurately reflect the page content. You return ONLY valid JSON, no prose, no markdown fences.`;

  const user = `Generate SEO meta data for this page.

Target keyword: ${keyword}
Page content:
"""
${pageContent}
"""

Rules:
- title: <= 60 characters, include the keyword naturally, no clickbait
- description: <= 155 characters, include the keyword naturally, end with an implicit reason to click
- keywords: array of 5-8 relevant keyword phrases related to the page content

Return ONLY this JSON shape, nothing else:
{ "title": string, "description": string, "keywords": string[] }`;

  return { system, user };
}

export function validateAdCopy(variations, platform) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.meta;
  return variations.map((v) => ({
    ...v,
    warnings: [
      v.headline && v.headline.length > limits.headline
        ? `Headline is ${v.headline.length} chars, over the ${limits.headline} limit`
        : null,
      v.body && v.body.length > limits.body
        ? `Body is ${v.body.length} chars, over the ${limits.body} limit`
        : null,
    ].filter(Boolean),
  }));
}

export function validateSeoMeta(meta) {
  const warnings = [];
  if (meta.title && meta.title.length > 60) {
    warnings.push(`Title is ${meta.title.length} chars, over the 60 char guideline`);
  }
  if (meta.description && meta.description.length > 155) {
    warnings.push(`Description is ${meta.description.length} chars, over the 155 char guideline`);
  }
  return { ...meta, warnings };
}
