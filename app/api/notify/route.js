// API Route (ทำงานฝั่ง server) — รับข้อความจาก client แล้วส่งต่อไปยัง Telegram
// เก็บ Bot Token ไว้ฝั่ง server เท่านั้น ป้องกันการรั่วไหลผ่าน browser

export async function POST(request) {
  try {
    const { message } = await request.json();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return Response.json(
        { ok: false, error: 'Telegram config ไม่ครบ (ตรวจสอบ Environment Variables)' },
        { status: 500 }
      );
    }

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await telegramRes.json();

    if (!data.ok) {
      return Response.json({ ok: false, error: data.description }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
