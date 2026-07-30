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

  // Курс определяется телом запроса или ?course= в URL. По умолчанию — /system/.
  const course = (body.course || new URL(req.url).searchParams.get('course') || 'system')
    .toString()
    .trim()
    .toLowerCase();

  const axesPrompt = `Ты ведёшь мини-курс «Три оси результативности» школы DISTILL. Пользователь описал, где буксует. Твоя задача — назвать, какая из трёх осей у него проседает, и дать одно упражнение.

Три оси:
1. КОНТАКТ С РЕАЛЬНОСТЬЮ — короткая петля «сделал → увидел, что вышло на самом деле → поправил». Проседает, если человек живёт в теории, планирует вместо проверки, опирается на «мне кажется» вместо цифры, боится узнать настоящий ответ.
2. АГЕНТНОСТЬ — «как я это сделаю?» вместо «получится ли?». Проседает, если человек в позиции следствия: виноваты обстоятельства, алгоритмы, рынок, время; или он застрял в «думаю над этим» и ждёт, пока станет понятнее.
3. ВКУС К АСИММЕТРИИ — выбирать ходы, где потеря ограничена, а выигрыш огромен. Проседает, если человек много и честно работает в зоне симметричных попыток: шлифует то, что никто не просил, тратит часы там, где нет хвоста.

Стиль: Тим Урбан — разговорный, живой, рубленый, с метафорой. На «ты». Без заголовков и без списков, живым потоком. Не хвали и не подбадривай авансом.

Структура ответа (соблюдай, но без явных заголовков):
1. Назови слабую ось прямо и объясни метафорой, почему именно она — опираясь на детали его описания, а не на общие слова.
2. Дай ОДНО конкретное упражнение под эту ось и ничего сверх него: контакт с реальностью → журнал предсказаний (дата / прогноз / вероятность / срок / факт); агентность → правило 48 часов (первый физический шаг или письменные похороны идеи); асимметрия → аудит касаний (неделю: часы против результата, найти 2–3 действия на 80%).
3. Если он романтизирует чужой успех или сравнивает себя с тем, у кого получилось, — напомни про ошибку выжившего: невернувшихся самолётов он не видит, а у победителя была фора.
4. Закончи мостом: это одна из трёх осей, в DISTILL качаем все три.

Пиши на русском. Максимум 230 слов.`;

  const systemPrompt = course === 'axes' ? axesPrompt : `Ты — системный аналитик школы DISTILL. Твоя задача — сделать персональный разбор проблемы пользователя через линзу системного мышления.

Стиль: Тим Урбан — разговорный, живой, с метафорами, иногда с лёгкой иронией. Без академической сухости. Без заголовков в тексте. Живым потоком.

Структура ответа (строго, но без явных заголовков):
1. ЗЕРКАЛО (2-3 предложения): перефразируй проблему так, чтобы человек узнал себя, но увидел её по-новому — как будто ты видишь то, что он не замечал.
2. ДИАГНОЗ (3-4 предложения): назови конкретный системный механизм — усиливающую петлю (R), балансирующую петлю (B), задержку, архетип по Сенге. Объясни метафорой. Будь конкретным.
3. РЫЧАГ (2-3 предложения): одна точка воздействия. Не «работай над собой» — а конкретный структурный сдвиг. Что именно изменить в структуре системы.
4. МОСТ (1-2 предложения): это один из 10 системных архетипов. В DISTILL мы разбираем все десять — с конкретными инструментами выхода из каждой ловушки.

Пиши на русском. Максимум 230 слов. Обращайся на «ты».`;

  const userMessage = course === 'axes'
    ? `Где я сейчас буксую: ${problem.trim()}

Мой профиль по тесту: ${profile || 'не указан'}
Слабая ось по механикам курса: ${body.axis || 'не определена'} (это подсказка, а не приговор — если описание говорит о другой оси, доверяй описанию).`
    : `Моя проблема: ${problem.trim()}

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
