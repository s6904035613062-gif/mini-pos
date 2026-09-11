"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });

  // สถานะสำหรับแก้ไขแบบ inline (เก็บ id ของแถวที่กำลังแก้ไข + ข้อมูลชั่วคราว)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดรายการสินค้าเมื่อ component ถูก mount
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data);
      setError('');
    }
    setLoading(false);
  }

  // จัดการค่าฟอร์มเพิ่มสินค้าใหม่
  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        unit: form.unit,
      },
    ]);

    if (error) {
      setError(error.message);
    } else {
      setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
      setError('');
      fetchProducts();
    }
  }

  // เริ่มแก้ไขแถว
  function startEdit(product) {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      fetchProducts();
    }
  }

  async function handleDelete(id) {
    const confirmDelete = confirm('ยืนยันการลบสินค้านี้หรือไม่?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setError(error.message);
    } else {
      fetchProducts();
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>รายการสินค้า</h1>

      {error && (
        <p style={{ color: 'red', marginBottom: 12 }}>เกิดข้อผิดพลาด: {error}</p>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <form onSubmit={handleAddProduct}>
        <h2 style={{ fontSize: '1.1rem' }}>เพิ่มสินค้าใหม่</h2>
        <input
          type="text"
          name="sku"
          placeholder="SKU"
          value={form.sku}
          onChange={handleFormChange}
        />
        <input
          type="text"
          name="name"
          placeholder="ชื่อสินค้า"
          value={form.name}
          onChange={handleFormChange}
        />
        <input
          type="number"
          name="price"
          placeholder="ราคา"
          step="0.01"
          value={form.price}
          onChange={handleFormChange}
        />
        <input
          type="number"
          name="stock"
          placeholder="จำนวนคงเหลือ"
          value={form.stock}
          onChange={handleFormChange}
        />
        <input
          type="text"
          name="unit"
          placeholder="หน่วย (เช่น ชิ้น, ขวด)"
          value={form.unit}
          onChange={handleFormChange}
        />
        <button type="submit">เพิ่มสินค้า</button>
      </form>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                {editingId === product.id ? (
                  // แถวโหมดแก้ไข
                  <>
                    <td>
                      <input
                        type="text"
                        name="sku"
                        value={editForm.sku}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="price"
                        step="0.01"
                        value={editForm.price}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="stock"
                        value={editForm.stock}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="unit"
                        value={editForm.unit}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveEdit(product.id)}>บันทึก</button>
                      <button onClick={cancelEdit}>ยกเลิก</button>
                    </td>
                  </>
                ) : (
                  // แถวโหมดแสดงผลปกติ
                  <>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{Number(product.price).toFixed(2)}</td>
                    <td>{product.stock}</td>
                    <td>{product.unit}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(product)}>แก้ไข</button>
                      <button onClick={() => handleDelete(product.id)}>ลบ</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 16 }}>
                  ยังไม่มีสินค้าในระบบ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
