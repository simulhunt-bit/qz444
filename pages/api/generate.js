import { getOpenAiClient } from '@/lib/openaiClient';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  buildAdCopyPrompt,
  buildSeoMetaPrompt,
  validateAdCopy,
  validateSeoMeta,
} from '@/lib/prompts';
import { logGeneration } from '@/lib/log';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional lightweight access gate (not real auth — a speed bump for a
  // no-login internal tool). Skipped entirely if ACCESS_PIN isn't set.
  if (process.env.ACCESS_PIN) {
    const providedPin = req.headers['x-access-pin'];
    if (providedPin !== process.env.ACCESS_PIN) {
      return res.status(401).json({ error: 'Invalid or missing access PIN' });
    }
  }

  const ip = getClientIp(req);
  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  const { type } = req.body || {};

  try {
    if (type === 'ad-copy') {
      return await handleAdCopy(req, res, remaining);
    }
    if (type === 'seo-meta') {
      return await handleSeoMeta(req, res, remaining);
    }
    return res.status(400).json({ error: 'Unknown type. Use "ad-copy" or "seo-meta".' });
  } catch (err) {
    console.error('Generation error:', err.message);
    return res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
}

async function handleAdCopy(req, res, remaining) {
  const { product, audience, tone, platform } = req.body || {};

  if (!product || !audience) {
    return res.status(400).json({ error: 'product and audience are required' });
  }

  const safePlatform = platform || 'meta';
  const safeTone = tone || 'friendly';

  const { system, user } = buildAdCopyPrompt({
    product,
    audience,
    tone: safeTone,
    platform: safePlatform,
  });

  const client = getOpenAiClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.8,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content || '[]';
  const parsed = safeParseJsonArray(raw);
  const variations = validateAdCopy(parsed, safePlatform);

  logGeneration({
    type: 'ad-copy',
    input: { product, audience, tone: safeTone, platform: safePlatform },
    output: variations,
  });

  return res.status(200).json({ variations, rateLimitRemaining: remaining });
}

async function handleSeoMeta(req, res, remaining) {
  const { pageContent, keyword } = req.body || {};

  if (!pageContent || !keyword) {
    return res.status(400).json({ error: 'pageContent and keyword are required' });
  }

  const { system, user } = buildSeoMetaPrompt({ pageContent, keyword });

  const client = getOpenAiClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  const parsed = safeParseJsonObject(raw);
  const meta = validateSeoMeta(parsed);

  logGeneration({
    type: 'seo-meta',
    input: { keyword, pageContentPreview: pageContent.slice(0, 200) },
    output: meta,
  });

  return res.status(200).json({ meta, rateLimitRemaining: remaining });
}

function safeParseJsonArray(raw) {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    // Model may have wrapped it, e.g. { "variations": [...] }
    const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
    return firstArray || [];
  } catch (e) {
    return [];
  }
}

function safeParseJsonObject(raw) {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {};
  }
}
