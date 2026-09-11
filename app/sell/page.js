"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // โหลดรายการสินค้าสำหรับ dropdown
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

  // หาสินค้าที่เลือกอยู่จาก id
  const selectedProduct = products.find((p) => p.id === selectedId);

  // คำนวณยอดรวมอัตโนมัติ
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  function resetForm() {
    setSelectedId('');
    setQuantity('');
  }

  async function handleSell(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedProduct) {
      setError('กรุณาเลือกสินค้า');
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setError('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }
    // ตรวจสอบว่าจำนวนคงเหลือเพียงพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setError(`สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`);
      return;
    }

    setSubmitting(true);

    // 1. บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setError(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2. อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (stockError) {
      setError(stockError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และโหลดข้อมูลสินค้าใหม่
    setSuccessMsg(
      `ขายสำเร็จ: ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} ยอดรวม ${totalPrice.toFixed(2)} บาท`
    );
    resetForm();
    fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>ขายสินค้า</h1>

      {error && (
        <p style={{ color: 'red', marginBottom: 12 }}>เกิดข้อผิดพลาด: {error}</p>
      )}
      {successMsg && (
        <p style={{ color: 'green', marginBottom: 12 }}>{successMsg}</p>
      )}

      {loading ? (
        <p>กำลังโหลดรายการสินค้า...</p>
      ) : (
        <form onSubmit={handleSell}>
          <label>
            สินค้า
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Number(p.price).toFixed(2)} บาท / {p.unit})
                </option>
              ))}
            </select>
          </label>

          <label>
            จำนวน
            <input
              type="number"
              min="1"
              placeholder="จำนวนที่ขาย"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>

          {/* แสดงยอดรวมอัตโนมัติก่อนกดยืนยัน */}
          <div className="card">
            <p>
              ราคาต่อหน่วย:{' '}
              {selectedProduct ? Number(selectedProduct.price).toFixed(2) : '0.00'} บาท
            </p>
            <p>คงเหลือในสต็อก: {selectedProduct ? selectedProduct.stock : '-'}</p>
            <p style={{ fontWeight: 700, marginTop: 8 }}>
              ยอดรวม: {totalPrice.toFixed(2)} บาท
            </p>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'ขาย'}
          </button>
        </form>
      )}
    </div>
  );
}
