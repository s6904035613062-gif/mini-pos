// ส่งข้อความแจ้งเตือนไปยัง Telegram ผ่าน API Route ของเราเอง
// ทำงานแบบ "fire and forget" — ถ้าพังก็แค่ log ไว้ ไม่กระทบผลลัพธ์การขาย
async function sendTelegramNotification(message) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram notify failed:', data.error);
    }
  } catch (err) {
    console.error('Telegram notify error:', err);
  }
}

// สร้างข้อความแจ้งเตือน "มีรายการขายใหม่"
function buildNewOrderMessage(item, stockAfter) {
  const now = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    `🛍️ <b>มีรายการขายใหม่!</b>\n` +
    `- สินค้า: ${item.name}\n` +
    `- จำนวน: ${item.quantity} ชิ้น\n` +
    `- ราคารวม: ${(item.price * item.quantity).toFixed(2)} บาท\n` +
    `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
    `- เวลา: ${now}`
  );
}

// สร้างข้อความแจ้งเตือน "สต๊อกใกล้หมด" (เกณฑ์ <= 5 ชิ้น)
const LOW_STOCK_THRESHOLD = 5;
function buildLowStockMessage(item, stockAfter) {
    return (
      `- สินค้า: ${item.name}\n` +
      `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
      `⚠️ กรุณาเติมสต็อกด่วน!`
    );
  }

  // อัปเดต stock ของสินค้าทีละรายการ
  for (const item of cart) {
    const newStock = item.stock - item.quantity;
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.productId);

    if (stockError) {
      setError(`บันทึกการขายสำเร็จ แต่ปรับสต็อก "${item.name}" ไม่สำเร็จ: ${stockError.message}`);
      setSubmitting(false);
      fetchProducts();
      return;
    }

    // --- เพิ่มใหม่: แจ้งเตือน Telegram หลังตัดสต็อกสำเร็จ (ไม่บล็อกการทำงานหลัก) ---
    sendTelegramNotification(buildNewOrderMessage(item, newStock));

    if (newStock <= LOW_STOCK_THRESHOLD) {
      sendTelegramNotification(buildLowStockMessage(item, newStock));
    }
  }
