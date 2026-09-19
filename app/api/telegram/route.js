// API Route นี้ทำงานฝั่ง Server เท่านั้น
// Token จะไม่ถูกฝังไปใน JavaScript bundle ที่ผู้ใช้เห็นได้จากเบราว์เซอร์
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return Response.json({ ok: false, error: 'missing message' }, { status: 400 });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('Telegram config ไม่ครบใน server environment');
      return Response.json({ ok: false, error: 'telegram config missing' }, { status: 500 });
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      console.error('Telegram API ตอบกลับผิดพลาด:', errData);
      return Response.json({ ok: false, error: errData }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('ส่ง Telegram notification ไม่สำเร็จ:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
