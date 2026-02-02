import React, { useState } from 'react';
import { Warehouse, CheckSquare, Send, ArrowRight } from 'lucide-react';
import { createStorageRequest } from '../services/ticketService';

const StorageFormPage = () => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [bike, setBike] = useState('');
    const [duration, setDuration] = useState(1);
    const [notes, setNotes] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (agreed) {
            await createStorageRequest(name, phone, bike, duration, notes);
            setSubmitted(true);
        }
    };

    // FIX: Reset state instead of reloading page
    const handleReset = () => {
        setName('');
        setPhone('');
        setBike('');
        setDuration(1);
        setNotes('');
        setAgreed(false);
        setSubmitted(false);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-2 border-emerald-100">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                        <CheckSquare size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase mb-2">Permintaan Terkirim!</h1>
                    <p className="text-slate-500 mb-6">Terima kasih. Tim kami akan segera menghubungi Anda untuk konfirmasi slot dan penjadwalan inspeksi unit.</p>
                    
                    {/* BUTTON UPDATED HERE */}
                    <button onClick={handleReset} className="text-emerald-600 font-bold hover:underline cursor-pointer">
                        Isi formulir baru
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="bg-purple-900 text-white p-6 pb-20">
                <div className="max-w-xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <Warehouse className="text-purple-300" size={32} />
                        <h1 className="text-2xl font-black italic tracking-tighter uppercase">Daily Bike Storage</h1>
                    </div>
                    <p className="text-purple-200">Formulir Pendaftaran Penitipan Sepeda (PIK 2)</p>
                </div>
            </div>

            <div className="max-w-xl mx-auto -mt-10 px-4 pb-20">
                <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6 border-2 border-slate-100">
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                            <input required className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-purple-500" value={name} onChange={e => setName(e.target.value)} placeholder="Nama Anda" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nomor WhatsApp</label>
                            <input required type="tel" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-purple-500" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model Sepeda</label>
                            <input required className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-purple-500" value={bike} onChange={e => setBike(e.target.value)} placeholder="Contoh: Brompton, Road Bike..." />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durasi Penitipan (Bulan)</label>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" min="1" max="12" step="1" 
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    value={duration} onChange={e => setDuration(parseInt(e.target.value))} 
                                />
                                <span className="text-2xl font-black text-purple-600 min-w-[3ch] text-center">{duration}</span>
                            </div>
                            <p className="text-xs text-right text-slate-400 font-bold mt-1">Bulan</p>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catatan Tambahan (Opsional)</label>
                            <textarea className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-purple-500" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ada sparepart tambahan? Kondisi khusus?" />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-sm text-slate-700 mb-2 uppercase">Syarat & Ketentuan</h3>
                        <div className="h-32 overflow-y-auto text-xs text-slate-500 space-y-2 pr-2 custom-scrollbar border-b border-slate-200 pb-2 mb-3">
                            <p>1. Daily Bike bertanggung jawab atas keamanan penyimpanan sepeda selama periode kontrak.</p>
                            <p>2. Pemilik wajib memberikan informasi jujur mengenai kondisi sepeda saat check-in.</p>
                            <p>3. Barang-barang berharga (garmin, lampu mahal, dll) sebaiknya dilepas atau dicatat secara spesifik.</p>
                            <p>4. Keterlambatan pengambilan setelah masa kontrak habis akan dikenakan biaya harian.</p>
                            <p>5. Kerusakan akibat force majeure (bencana alam) di luar tanggung jawab manajemen.</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 accent-purple-600 rounded" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                            <span className="text-xs font-bold text-slate-700">Saya menyetujui syarat & ketentuan di atas.</span>
                        </label>
                    </div>

                    <button 
                        type="submit" 
                        disabled={!agreed || !name || !phone || !bike}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                        Kirim Permintaan <ArrowRight size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default StorageFormPage;