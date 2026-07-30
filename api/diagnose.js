export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { problem, profile } = body;

  if (!problem || problem.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'Problem too short' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = `Ты — системный аналитик школы DISTILL. Твоя задача — сделать персональный разбор проблемы пользователя через линзу системного мышления.

Стиль: Тим Урбан — разговорный, живой, с метафорами, иногда с лёгкой иронией. Без академической сухости. Без заголовков в тексте. Живым потоком.

Структура ответа (строго, но без явных заголовков):
1. ЗЕРКАЛО (2-3 предложения): перефразируй проблему так, чтобы человек узнал себя, но увидел её по-новому — как будто ты видишь то, что он не замечал.
2. ДИАГНОЗ (3-4 предложения): назови конкретный системный механизм — усиливающую петлю (R), балансирующую петлю (B), задержку, архетип по Сенге. Объясни метафорой. Будь конкретным.
3. РЫЧАГ (2-3 предложения): одна точка воздействия. Не «работай над собой» — а конкретный структурный сдвиг. Что именно изменить в структуре системы.
4. МОСТ (1-2 предложения): это один из 10 системных архетипов. В DISTILL мы разбираем все десять — с конкретными инструментами выхода из каждой ловушки.

Пиши на русском. Максимум 230 слов. Обращайся на «ты».`;

  const userMessage = `Моя проблема: ${problem.trim()}

Мой профиль из курса: ${profile || 'не указан'}`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 450,
        temperature: 0.75,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI error:', errText);
      return new Response(JSON.stringify({ error: 'OpenAI request failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await openaiRes.json();
    const diagnosis = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ diagnosis }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Handler error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
