import React, { useState, useEffect } from 'react';
import {
  Edit,
  Plus,
  Save,
  Trash2,
  Search,
  PackagePlus,
} from 'lucide-react';
import toast from '../components/ui/toast';
import { confirm } from '../components/ui/confirm';
import RightDrawer from '../components/RightDrawer';
import { apiV1 } from '../lib/apiV1';
import ListToolbar from '../components/ListToolbar';
import type { FilterField, FilterValues } from '../components/FilterDrawer';
import { exportExcelFile } from '../lib/excelExport';

interface CustomerGroup {
  id: number;
  code: string;
  name: string;
  priceBookId?: number | null;
  priceBook?: { id: number; code: string; name: string } | null;
  children?: CustomerGroup[];
}

interface PriceBook {
  id: number;
  code: string;
  name: string;
}

const emptyForm = () => ({ code: '', name: '', priceBookId: 0 });

function CustomerGroups() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [form, setForm] = useState(emptyForm());

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/customer-groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Không tải được danh sách nhóm khách hàng');
      const data = await res.json();
      const rows: CustomerGroup[] = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      // Backend trả cây (root + children) → làm phẳng để hiển thị bảng
      const flattened = rows.flatMap(g => [g, ...(g.children || [])]);
      setGroups(
        Array.from(new Map(flattened.map(g => [g.id, g])).values()),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceBooks = async () => {
    try {
      const res = await apiV1<PriceBook[]>(
        '/api/v1/catalog/price-books?limit=100',
      );
      setPriceBooks(res.data || []);
    } catch {
      setPriceBooks([]);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchPriceBooks();
  }, []);

  const priceBookLabel = (group: CustomerGroup) => {
    if (group.priceBook) return `${group.priceBook.name} (${group.priceBook.code})`;
    const pb = priceBooks.find(p => p.id === group.priceBookId);
    if (pb) return `${pb.name} (${pb.code})`;
    return '—';
  };

  const handleCreate = () => {
    setEditingGroup(null);
    setForm(emptyForm());
    setModalOpen('create');
  };

  const handleEdit = (group: CustomerGroup) => {
    setEditingGroup(group);
    setForm({
      code: group.code,
      name: group.name,
      priceBookId: group.priceBookId || group.priceBook?.id || 0,
    });
    setModalOpen('edit');
  };

  const handleDelete = async (group: CustomerGroup) => {
    if (!(await confirm(`Xóa nhóm khách hàng "${group.name}"?`))) return;
    try {
      const res = await fetch(`/api/v1/customer-groups/${group.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Lỗi khi xóa nhóm khách hàng');
      toast.success('Đã xóa nhóm khách hàng');
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Mã nhóm và tên nhóm là bắt buộc');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        priceBookId: form.priceBookId || null,
      };
      const isEdit = modalOpen === 'edit';
      const res = await fetch(
        isEdit ? `/api/v1/customer-groups/${editingGroup!.id}` : '/api/v1/customer-groups',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Có lỗi xảy ra');
      toast.success(isEdit ? 'Cập nhật thành công' : 'Đã thêm nhóm khách hàng');
      setModalOpen(null);
      setEditingGroup(null);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi hệ thống');
    } finally {
      setSaving(false);
    }
  };

  const keyword = searchTerm.trim().toLowerCase();
  const filtered = groups.filter(
    g =>
      (!keyword ||
        g.code?.toLowerCase().includes(keyword) ||
        g.name?.toLowerCase().includes(keyword)) &&
      (!filters.priceBookId ||
        String(g.priceBookId || '') === filters.priceBookId),
  );
  const filterFields: FilterField[] = [
    {
      type: 'select',
      key: 'priceBookId',
      label: 'Bảng giá',
      options: priceBooks.map(book => ({
        value: String(book.id),
        label: `${book.name} (${book.code})`,
      })),
    },
  ];
  const exportGroups = () =>
    exportExcelFile(
      'nhom-khach-hang.xlsx',
      'Nhom khach hang',
      [
        { header: 'Mã nhóm', value: (row: CustomerGroup) => row.code },
        { header: 'Tên nhóm', value: (row: CustomerGroup) => row.name, width: 30 },
        {
          header: 'Bảng giá',
          value: (row: CustomerGroup) => priceBookLabel(row),
          width: 28,
        },
      ],
      filtered,
    );

  return (
    <div>
      <div className="erp-page-header">
        <div>
          <h1>Quản lý nhóm khách hàng</h1>
          <p>Nhóm khách hàng dùng để gán bảng giá bán áp dụng</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button onClick={handleCreate} className="erp-btn erp-btn-primary">
            <Plus size={16} /> Thêm nhóm
          </button>
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        <ListToolbar
          fields={filterFields}
          values={filters}
          onChange={setFilters}
          onExport={exportGroups}
          exportDisabled={filtered.length === 0}
          search={
            <div className="erp-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm theo mã, tên nhóm..."
              />
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Mã nhóm</th>
                <th>Tên nhóm</th>
                <th>Bảng giá áp dụng</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <PackagePlus size={48} className="mx-auto mb-3 opacity-50" />
                    <p>Chưa có nhóm khách hàng nào</p>
                  </td>
                </tr>
              ) : (
                filtered.map(group => (
                  <tr key={group.id}>
                    <td className="font-mono text-sm font-semibold">{group.code}</td>
                    <td className="font-medium">{group.name}</td>
                    <td>{priceBookLabel(group)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Sửa"
                          onClick={() => handleEdit(group)}
                          className="erp-icon-btn text-blue-600"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          title="Xóa"
                          onClick={() => handleDelete(group)}
                          className="erp-icon-btn text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RightDrawer
        open={modalOpen !== null}
        title={modalOpen === 'create' ? 'Thêm nhóm khách hàng' : `Sửa nhóm: ${editingGroup?.name || ''}`}
        subtitle="Mã nhóm, tên nhóm và bảng giá áp dụng"
        onClose={() => {
          setModalOpen(null);
          setEditingGroup(null);
        }}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setModalOpen(null);
                setEditingGroup(null);
              }}
              className="erp-btn"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                (
                  document.getElementById(
                    'customer-group-form',
                  ) as HTMLFormElement | null
                )?.requestSubmit()
              }
              className="erp-btn erp-btn-primary"
            >
              <Save size={14} /> {saving ? 'Đang lưu...' : modalOpen === 'create' ? 'Thêm nhóm' : 'Cập nhật'}
            </button>
          </>
        }
      >
        <form id="customer-group-form" onSubmit={handleSave} className="space-y-4">
          <label className="block text-[13px] font-medium text-slate-700">
            <span className="mb-1 block">
              Mã nhóm <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              required
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="VD: DAILY"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block text-[13px] font-medium text-slate-700">
            <span className="mb-1 block">
              Tên nhóm <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ví dụ: Đại lý"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block text-[13px] font-medium text-slate-700">
            <span className="mb-1 block">Bảng giá áp dụng</span>
            <select
              value={form.priceBookId}
              onChange={e => setForm({ ...form, priceBookId: Number(e.target.value) || 0 })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value={0}>-- Không áp dụng bảng giá --</option>
              {priceBooks.map(pb => (
                <option key={pb.id} value={pb.id}>
                  {pb.name} ({pb.code})
                </option>
              ))}
            </select>
          </label>
        </form>
      </RightDrawer>
    </div>
  );
}

export default CustomerGroups;
