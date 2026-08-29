import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Calendar } from 'lucide-react';
import { formatDate } from '../lib/utils';

interface AuditLog {
  id: number;
  action: string;
  details: string;
  userName: string;
  createdAt: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error("Lỗi khi tải lịch sử thao tác", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !dateFilter || log.createdAt.startsWith(dateFilter);
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">NHẬT KÝ HOẠT ĐỘNG</h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Lịch sử các thao tác của nhân viên trên hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm hành động, nhân viên..."
              className="bg-white border text-xs font-bold uppercase py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="bg-white border rounded-xl flex items-center px-3 py-2">
            <Calendar size={16} className="text-gray-400 mr-2" />
            <input 
              type="date"
              className="border-none outline-none text-xs font-black uppercase text-gray-700 bg-transparent"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hành động</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi tiết</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân viên</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-700">{formatDate(log.createdAt).split(' ')[0]}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(log.createdAt).split(' ')[1]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-tight border border-indigo-100/50 shadow-sm">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-slate-600 leading-relaxed max-w-md">{log.details}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black uppercase text-slate-600 border border-slate-200">
                          {log.userName?.charAt(0)}
                        </div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{log.userName}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-24 text-center">
                    <History className="mx-auto text-slate-200 mb-4" size={48} />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Không có dữ liệu phù hợp</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hiển thị {filteredLogs.length} thao tác gần nhất</p>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
