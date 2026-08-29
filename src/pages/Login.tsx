import React, { useState } from 'react';
import { Warehouse, Lock, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('refreshToken', data.data.refreshToken);
        onLogin(data.data.accessToken, data.data.user);
        toast.success(`Chào mừng trở lại, ${data.data.user.fullName}`);
      } else {
        toast.error(data.message || 'Đăng nhập thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4">
            <img
              src="/public/images/logo3.jpg"
              alt="Challenge Logo"
              className="w-32 h-32 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">CHALLENGE WAREHOUSE</h1>
          <p className="text-slate-500 font-medium text-sm">Đăng nhập để quản lý kho hàng của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2.5 block font-medium text-slate-700">Tên đăng nhập</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent py-4 pl-6 pr-10 outline-none focus:border-blue-500 focus-visible:shadow-none"
                required
              />
              <UserIcon className="absolute right-4 top-4 text-slate-400" size={22} />
            </div>
          </div>

          <div>
            <label className="mb-2.5 block font-medium text-slate-700">Mật khẩu</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent py-4 pl-6 pr-10 outline-none focus:border-blue-500 focus-visible:shadow-none"
                required
              />
              <Lock className="absolute right-4 top-4 text-slate-400" size={22} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-lg border border-blue-500 bg-blue-500 p-4 text-white transition hover:bg-opacity-90 disabled:bg-slate-400"
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>


      </div>
    </div>
  );
};

export default Login;
