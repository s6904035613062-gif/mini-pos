"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // โหลดประวัติการขายเมื่อ component ถูก mount
  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false }); // ล่าสุดไปเก่าสุด

    if (error) {
      setError(error.message);
    } else {
      setSales(data);
      setError('');
    }
    setLoading(false);
  }

  // แปลงวันเวลาให้อ่านง่ายตามรูปแบบไทย
  function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // คำนวณยอดขายรวมทั้งหมดจากรายการที่โหลดมา
  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.total_price),
    0
  );

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>ประวัติการขาย</h1>

      {error && (
        <p style={{ color: 'red', marginBottom: 12 }}>เกิดข้อผิดพลาด: {error}</p>
      )}

      {/* สรุปยอดขายรวมทั้งหมด */}
      <div className="card">
        <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>
          ยอดขายรวมทั้งหมด: {totalRevenue.toFixed(2)} บาท
        </p>
        <p>จำนวนรายการขายทั้งหมด: {sales.length} รายการ</p>
      </div>

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDateTime(sale.sold_at)}</td>
                <td>{sale.product_name}</td>
                <td>{sale.quantity}</td>
                <td>{Number(sale.total_price).toFixed(2)} บาท</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 16 }}>
                  ยังไม่มีประวัติการขาย
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
