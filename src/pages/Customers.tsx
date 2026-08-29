import React, { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, X, Search, Phone, MapPin, Mail, Download, Filter, Clock3, WalletCards, CircleDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { Customer } from '../types';

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Partial<Customer> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setCustomers(await res.json());
      } else {
        toast.error('Lỗi khi tải danh sách khách hàng');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const isEdit = !!selectedCustomer.id;
      const url = isEdit ? `/api/customers/${selectedCustomer.id}` : '/api/customers';

      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(selectedCustomer)
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm khách hàng thành công');
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      toast.error('Có lỗi hệ thống');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) return;

    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        toast.success('Đã xóa khách hàng');
        fetchCustomers();
      } else {
        toast.error('Lỗi khi xóa khách hàng');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.taxCode?.includes(searchTerm) ||
    c.groupName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalDebt = customers.reduce((sum, customer) => sum + Number(customer.debt || 0), 0);
  const overdueDebt = customers.reduce((sum, customer) => sum + Number(customer.overdueDebt || 0), 0);
  const paidLast30Days = customers.reduce((sum, customer) => sum + Number(customer.paidLast30Days || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">QUẢN LÝ KHÁCH HÀNG</h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Danh mục khách hàng & Đối tác</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
             setSelectedCustomer({ code: '', name: '', phone: '', address: '', email: '', taxCode: '', groupName: 'Sỉ' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary py-3 px-6 text-xs font-black text-white hover:bg-opacity-90 transition-all shadow-lg active:scale-95"
          >
            <UserPlus size={18} /> THÊM KHÁCH HÀNG
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-stat"><Clock3/><div><span>Nợ quá hạn</span><strong className="text-red-600">{new Intl.NumberFormat('vi-VN').format(overdueDebt)} ₫</strong></div></div>
        <div className="erp-stat"><WalletCards/><div><span>Tổng nợ phải thu</span><strong>{new Intl.NumberFormat('vi-VN').format(totalDebt)} ₫</strong></div></div>
        <div className="erp-stat"><CircleDollarSign/><div><span>Đã thanh toán (30 ngày)</span><strong>{new Intl.NumberFormat('vi-VN').format(paidLast30Days)} ₫</strong></div></div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, SĐT, mã số thuế..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100">
              <Filter size={18} />
            </button>
            <button className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100">
              <Download size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-gray-400 font-black uppercase tracking-widest border-b h-12">
                <th className="px-4">Mã / Khách hàng</th>
                <th className="px-4">Liên hệ</th>
                <th className="px-4">Địa chỉ</th>
                <th className="px-4">Mã số thuế</th>
                <th className="px-4 text-right">Công nợ</th>
                <th className="px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black border border-indigo-100 shadow-sm uppercase group-hover:scale-110 transition-transform">
                        {customer.name.charAt(0)}
                      </div>
                       <div><p className="font-black text-gray-800 text-sm tracking-tight">{customer.name}</p><small className="text-gray-400">{customer.code}</small></div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                          <Phone size={12} className="text-gray-300" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Mail size={12} className="text-gray-300" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xs text-gray-500 font-bold max-w-xs truncate">
                      {customer.address || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {customer.taxCode || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-right"><b className={Number(customer.overdueDebt)>0?'text-red-600':'text-gray-700'}>{new Intl.NumberFormat('vi-VN').format(Number(customer.debt||0))} ₫</b>{Number(customer.overdueDebt)>0&&<small className="block text-red-500">Quá hạn: {new Intl.NumberFormat('vi-VN').format(Number(customer.overdueDebt))} ₫</small>}</div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Chỉnh sửa"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                        title="Xóa"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <UserPlus size={64} />
                      <p className="mt-4 font-black uppercase text-sm tracking-widest">Không tìm thấy khách hàng nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="mb-8 flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">
                  {selectedCustomer?.id ? 'CHỈNH SỬA KHÁCH HÀNG' : 'THÊM KHÁCH HÀNG MỚI'}
                </h3>
                <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Thông tin chi tiết đối tác</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-gray-400 uppercase tracking-wider">Mã khách hàng</label>
                  <input type="text" placeholder="Tự sinh nếu để trống" value={selectedCustomer?.code || ''} onChange={(e) => setSelectedCustomer({ ...selectedCustomer!, code: e.target.value })} className="w-full rounded-xl border-2 border-gray-100 p-3 text-sm font-bold text-gray-700 outline-none focus:border-primary" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[10px] font-black text-gray-400 uppercase tracking-wider">Họ và tên / Tên công ty</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A / Công ty TNHH..."
                    value={selectedCustomer?.name || ''}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer!, name: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-100 p-3 text-sm font-black text-gray-700 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-gray-400 uppercase tracking-wider">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input
                      type="text"
                      placeholder="09xxx..."
                      value={selectedCustomer?.phone || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer!, phone: e.target.value })}
                      className="w-full pl-10 rounded-xl border-2 border-gray-100 p-3 text-sm font-black text-gray-700 outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black text-gray-400 uppercase tracking-wider">Nhóm khách hàng</label>
                  <select
                    value={selectedCustomer?.groupName || 'Sỉ'}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer!, groupName: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-100 p-3 text-sm font-black text-gray-700 outline-none focus:border-primary bg-white"
                  >
                    <option value="Kho">Kho</option>
                    <option value="NPP">Nhà phân phối</option>
                    <option value="Kinh doanh">Phòng kinh doanh</option>
                    <option value="Tài xế">Tài xế</option>
                    <option value="Lẻ">Khách lẻ</option>
                    <option value="Quà">Tặng khách</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black text-gray-400 uppercase tracking-wider">Mã số thuế</label>
                <input
                  type="text"
                  placeholder="370xxxxx..."
                  value={selectedCustomer?.taxCode || ''}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer!, taxCode: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-100 p-3 text-sm font-mono font-bold text-gray-700 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black text-gray-400 uppercase tracking-wider">Địa chỉ giao hàng / Trụ sở</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-300" size={16} />
                  <textarea
                    rows={3}
                    placeholder="Số nhà, đường, phường/xã..."
                    value={selectedCustomer?.address || ''}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer!, address: e.target.value })}
                    className="w-full pl-10 rounded-xl border-2 border-gray-100 p-3 text-sm font-bold text-gray-700 outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-10 py-3 text-xs font-black text-white hover:bg-opacity-90 shadow-xl shadow-primary/20 uppercase tracking-widest transition-all active:scale-95"
                >
                  LƯU THÔNG TIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
