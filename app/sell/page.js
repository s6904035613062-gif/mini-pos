"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

// อ่านค่า config ของ Telegram จาก environment variables
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
const LOW_STOCK_THRESHOLD = 5; // เกณฑ์แจ้งเตือนสต๊อกเหลือน้อย

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data);
      setError('');
    }
    setLoading(false);
  }

  const selectedProduct = products.find((p) => p.id === selectedId);
  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function handleAddToCart(e) {
    e.preventDefault();
    setError('');

    if (!selectedProduct) {
      setError('กรุณาเลือกสินค้า');
      return;
    }
    const qty = parseInt(addQty, 10) || 0;
    if (qty <= 0) {
      setError('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }

    const existing = cart.find((item) => item.productId === selectedProduct.id);
    const alreadyInCart = existing ? existing.quantity : 0;
    if (alreadyInCart + qty > selectedProduct.stock) {
      setError(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit}, ในตะกร้ามีอยู่แล้ว ${alreadyInCart})`
      );
      return;
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.productId === selectedProduct.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          unit: selectedProduct.unit,
          stock: selectedProduct.stock,
          quantity: qty,
        },
      ]);
    }

    setSelectedId('');
    setAddQty('1');
  }

  function updateCartQuantity(productId, newQty) {
    const qty = parseInt(newQty, 10) || 0;
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    if (qty > item.stock) {
      setError(`สินค้าคงเหลือไม่พอ (คงเหลือ ${item.stock} ${item.unit})`);
      return;
    }
    setError('');
    setCart(
      cart.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  }

  function removeFromCart(productId) {
    setCart(cart.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setCart([]);
  }

  // ===== ฟังก์ชันส่งข้อความแจ้งเตือนเข้า Telegram =====
  // ทำงานแบบ async/try-catch เสมอ และไม่ throw error ออกไป
  // เพื่อไม่ให้กระทบ flow การขายหลัก แม้ Telegram API มีปัญหา
  async function sendTelegramNotification(messageText) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('Telegram config ไม่ครบ ข้ามการแจ้งเตือน');
      return;
    }
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: messageText,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        console.error('Telegram API ตอบกลับผิดพลาด:', errData);
      }
    } catch (err) {
      console.error('ส่ง Telegram notification ไม่สำเร็จ:', err);
    }
  }

  // สร้างข้อความแจ้งเตือน Order ใหม่
  function buildNewOrderMessage(item, newStock) {
    const now = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return (
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- จำนวน: ${item.quantity} ชิ้น\n` +
      `- ราคารวม: ${(item.price * item.quantity).toFixed(2)} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${now}`
    );
  }

  // สร้างข้อความแจ้งเตือนสต๊อกเหลือน้อย
  function buildLowStockMessage(item, newStock) {
    return (
      `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
      `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
    );
  }

  async function handleCheckout() {
    setError('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setError('ยังไม่มีสินค้าในตะกร้า');
      return;
    }

    setSubmitting(true);
    const soldAt = new Date().toISOString();

    const salesRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from('sales').insert(salesRows);
    if (saleError) {
      setError(saleError.message);
      setSubmitting(false);
      return;
    }

    // อัปเดต stock ทีละรายการ พร้อมส่งแจ้งเตือน Telegram หลังตัดสต๊อกสำเร็จ
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

      // งานที่ 1: แจ้งเตือน Order เข้า
      sendTelegramNotification(buildNewOrderMessage(item, newStock));

      // งานที่ 2: เช็คสต๊อกเหลือน้อย ถ้าเข้าเกณฑ์ให้ยิงข้อความเตือนภัยเพิ่มอีก 1 ข้อความ
      if (newStock <= LOW_STOCK_THRESHOLD) {
        sendTelegramNotification(buildLowStockMessage(item, newStock));
      }
    }

    setSuccessMsg(`ขายสำเร็จ! รวม ${totalItemsCount} ชิ้น ยอดรวม ${grandTotal.toFixed(2)} บาท`);
    clearCart();
    fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>ขายสินค้า</h1>

      <div
        style={{
          backgroundColor: '#2c3e50',
          color: '#fff',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>ยอดรวมทั้งหมด</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.1 }}>
            {grandTotal.toFixed(2)} <span style={{ fontSize: '1.2rem' }}>บาท</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>จำนวนสินค้า</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{totalItemsCount} ชิ้น</div>
        </div>
      </div>

      {error && (
        <p style={{ color: 'red', marginBottom: 12 }}>เกิดข้อผิดพลาด: {error}</p>
      )}
      {successMsg && (
        <p style={{ color: 'green', marginBottom: 12, fontWeight: 600 }}>{successMsg}</p>
      )}

      {loading ? (
        <p>กำลังโหลดรายการสินค้า...</p>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <form onSubmit={handleAddToCart} style={{ flex: '1 1 300px', maxWidth: 400 }}>
            <h2 style={{ fontSize: '1.1rem' }}>เลือกสินค้า</h2>
            <label>
              สินค้า
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({Number(p.price).toFixed(2)} บาท / {p.unit}) — คงเหลือ {p.stock}
                  </option>
                ))}
              </select>
            </label>

            <label>
              จำนวน
              <input
                type="number"
                min="1"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />
            </label>

            {selectedProduct && (
              <div className="card">
                <p>ราคาต่อหน่วย: {Number(selectedProduct.price).toFixed(2)} บาท</p>
                <p>คงเหลือในสต็อก: {selectedProduct.stock} {selectedProduct.unit}</p>
              </div>
            )}

            <button type="submit">+ เพิ่มลงตะกร้า</button>
          </form>

          <div style={{ flex: '2 1 400px' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 10 }}>รายการที่จะขาย</h2>

            {cart.length === 0 ? (
              <div className="card">
                <p style={{ textAlign: 'center', color: '#888' }}>
                  ยังไม่มีสินค้าในตะกร้า — เลือกสินค้าจากฝั่งซ้ายเพื่อเพิ่ม
                </p>
              </div>
            ) : (
              <table style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>ราคา/หน่วย</th>
                    <th>จำนวน</th>
                    <th>รวม</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{Number(item.price).toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartQuantity(item.productId, e.target.value)
                          }
                          style={{ width: 70 }}
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {(item.price * item.quantity).toFixed(2)}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          style={{ backgroundColor: '#c0392b' }}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {cart.length > 0 && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleCheckout}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    fontSize: '1.1rem',
                    padding: '14px 0',
                    backgroundColor: '#27ae60',
                  }}
                >
                  {submitting ? 'กำลังบันทึก...' : `ยืนยันการขาย (${grandTotal.toFixed(2)} บาท)`}
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={submitting}
                  style={{ backgroundColor: '#7f8c8d' }}
                >
                  ล้างตะกร้า
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
