import React, { useState, useMemo } from "react";
import { Ticket, Branch, MechanicDefinition, flag_type } from "../types";
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Award,
  Info,
  Shield,
  Clock,
  Check,
  FileBarChart2
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface PerformanceProps {
  tickets: Ticket[];
  mechanics: MechanicDefinition[];
  currentBranch: Branch;
}

interface Period {
  type: "monthly" | "yearly";
  label: string;
  subtext: string;
  startDate: Date;
  endDate: Date;
}

export const Performance: React.FC<PerformanceProps> = ({
  tickets,
  mechanics,
  currentBranch
}) => {
  const [filterType, setFilterType] = useState<"monthly" | "yearly">("monthly");
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0);

  const isMK = currentBranch === "mk";
  const branchLabel = isMK ? "Muara Karang" : "PIK 2";
  const themeColorClass = isMK ? "text-blue-600" : "text-emerald-600";
  const themeBgClass = isMK ? "bg-blue-600" : "bg-emerald-600";
  const themeBorderClass = isMK ? "border-blue-500" : "border-emerald-500";

  // Date generators
  const monthlyPeriods = useMemo(() => {
    const result: Period[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember"
    ];

    for (let i = 0; i < 12; i++) {
      let m = currentMonth - i;
      let y = currentYear;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      const endDate = new Date(y, m, 28, 23, 59, 59, 999);
      
      let startMonth = m - 1;
      let startYear = y;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
      const startDate = new Date(startYear, startMonth, 29, 0, 0, 0, 0);

      result.push({
        type: "monthly",
        label: `${monthNames[m]} ${y}`,
        subtext: `29 ${monthNames[startMonth].substring(0, 3)} - 28 ${monthNames[m].substring(0, 3)} ${y}`,
        startDate,
        endDate
      });
    }
    return result;
  }, []);

  const yearlyPeriods = useMemo(() => {
    const result: Period[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    for (let i = 0; i < 3; i++) {
      const y = currentYear - i;
      const endDate = new Date(y, 11, 28, 23, 59, 59, 999);
      const startDate = new Date(y - 1, 11, 29, 0, 0, 0, 0);

      result.push({
        type: "yearly",
        label: `Tahun ${y}`,
        subtext: `29 Des ${y - 1} - 28 Des ${y}`,
        startDate,
        endDate
      });
    }
    return result;
  }, []);

  const periods = filterType === "monthly" ? monthlyPeriods : yearlyPeriods;

  // Make sure selection is in range if filterType toggles
  const activePeriod = useMemo(() => {
    if (selectedPeriodIndex >= periods.length) {
      return periods[0];
    }
    return periods[selectedPeriodIndex];
  }, [periods, selectedPeriodIndex]);

  // Metric calculation functions matching DebriefModal
  const isGaransiTicket = (t: Ticket) => {
    const hasGaransiNote = t.notes && t.notes.includes("[GARANSI]");
    const hasGaransiService = t.serviceTypes && t.serviceTypes.some(s => s.trim().toUpperCase() === "GARANSI");
    return !!(hasGaransiNote || hasGaransiService);
  };

  const isBerhasilTicket = (t: Ticket) => {
    if (isGaransiTicket(t)) return false;
    const res = t.followUpResult ? t.followUpResult.trim() : "";
    return res === "Selesai" || res === "Berhasil" || res === "Tidak Respond" || res === "Milik Internal";
  };

  const isBermasalahTicket = (t: Ticket) => {
    if (isGaransiTicket(t)) return false;
    return t.followUpResult?.trim() === "Kendala";
  };

  // Compile stats
  const stats = useMemo(() => {
    const start = activePeriod.startDate;
    const end = activePeriod.endDate;

    const filtered = tickets.filter(t => {
      if (t.branch !== currentBranch) return false;
      if (t.status === "cancelled") return false;
      if (t.status !== "done") return false;
      if (!t.followUpResult || t.followUpResult.trim() === "") return false;
      
      const tFinished = t.timestamps?.finished ? new Date(t.timestamps.finished) : null;
      if (!tFinished) return false;
      return tFinished >= start && tFinished <= end;
    });

    const totalSelesai = filtered.filter(t => !isGaransiTicket(t)).length;
    const berhasil = filtered.filter(t => isBerhasilTicket(t)).length;
    const bermasalah = filtered.filter(t => isBermasalahTicket(t)).length;
    const garansi = filtered.filter(t => isGaransiTicket(t)).length;

    const berhasilPct = totalSelesai > 0 ? Math.round((berhasil / totalSelesai) * 100) : 0;
    const bermasalahPct = totalSelesai > 0 ? Math.round((bermasalah / totalSelesai) * 100) : 0;

    // Admin penalties calculated from filtered (truly done tickets)
    const adminTelatUpdateAntrian = filtered.filter(t => 
      t.flags?.some(f2 => (f2 as any) === "TELAT_UPDATE_ANTRIAN" || (f2 as any) === "TELAT_UPDATE")
    ).length;

    const adminTelatFollowUp = filtered.filter(t => 
      t.flags?.some(f2 => (f2 as any) === "TELAT_FOLLOW_UP" || (f2 as any) === "LATE_FOLLOW_UP")
    ).length;

    // Mechanics list calculated from filtered (truly done tickets)
    const mechanicPerformance = mechanics.map(m => {
      const picTickets = filtered.filter(t => {
        const nameUpper = m.name.trim().toUpperCase();
        return (t.mechanic?.trim().toUpperCase() === nameUpper) || (t.overtimeMechanic?.trim().toUpperCase() === nameUpper);
      });

      const selesaiPicCount = picTickets.filter(t => !isGaransiTicket(t)).length;
      const garansiPicCount = picTickets.filter(t => isGaransiTicket(t)).length;

      const telatUpdateService = picTickets.filter(t => 
        t.flags?.includes("TELAT_UPDATE_SERVICE" as any)
      ).length;

      const telatUpdateSelesai = picTickets.filter(t => 
        t.flags?.includes("TELAT_UPDATE_SELESAI" as any)
      ).length;

      const resiHilang = picTickets.filter(t => 
        t.flags?.includes("RESI_HILANG" as any)
      ).length;

      const totalPenalties = telatUpdateService + telatUpdateSelesai + resiHilang;
      const complianceScore = (selesaiPicCount + garansiPicCount) > 0 
        ? Math.max(0, 100 - Math.round((totalPenalties / (selesaiPicCount + garansiPicCount)) * 100))
        : (totalPenalties > 0 ? 0 : 100);

      return {
        id: m.id,
        name: m.name,
        selesai: selesaiPicCount,
        garansi: garansiPicCount,
        telatUpdateService,
        telatUpdateSelesai,
        resiHilang,
        active: picTickets.length > 0,
        complianceScore
      };
    }).sort((a, b) => b.selesai - a.selesai);

    return {
      totalSelesai,
      berhasil,
      bermasalah,
      garansi,
      berhasilPct,
      bermasalahPct,
      adminTelatUpdateAntrian,
      adminTelatFollowUp,
      mechanicPerformance,
      rawFilteredCount: filtered.length,
      totalProcessed: filtered.length
    };
  }, [activePeriod, tickets, mechanics, currentBranch]);

  // Compile monthly trend data (last 6 months) for visualization
  const trendData = useMemo(() => {
    // We reverse the last 6 months to order chronological (oldest to newest)
    const list = [...monthlyPeriods].slice(0, 6).reverse();
    return list.map(p => {
      const filtered = tickets.filter(t => {
        if (t.branch !== currentBranch) return false;
        if (t.status === "cancelled") return false;
        if (t.status !== "done") return false;
        if (!t.followUpResult || t.followUpResult.trim() === "") return false;
        
        const tFinished = t.timestamps?.finished ? new Date(t.timestamps.finished) : null;
        if (!tFinished) return false;
        return tFinished >= p.startDate && tFinished <= p.endDate;
      });

      const totalSelesai = filtered.filter(t => !isGaransiTicket(t)).length;
      const berhasil = filtered.filter(t => isBerhasilTicket(t)).length;
      const bermasalah = filtered.filter(t => isBermasalahTicket(t)).length;

      const labelParts = p.label.split(" ");
      const shortMonthLabel = labelParts[0].substring(0, 3) + " " + labelParts[1].substring(2);

      return {
        name: shortMonthLabel,
        "Total Servis": totalSelesai,
        "Selesai": berhasil,
        "Bermasalah": bermasalah
      };
    });
  }, [monthlyPeriods, tickets, currentBranch]);

  const pieData = useMemo(() => {
    return [
      { name: "Selesai", value: stats.berhasil, color: "#10b981" },
      { name: "Bermasalah", value: stats.bermasalah, color: "#f43f5e" }
    ];
  }, [stats]);

  const handlePrevPeriod = () => {
    if (selectedPeriodIndex < periods.length - 1) {
      setSelectedPeriodIndex(prev => prev + 1);
    }
  };

  const handleNextPeriod = () => {
    if (selectedPeriodIndex > 0) {
      setSelectedPeriodIndex(prev => prev - 1);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
            <TrendingUp size={16} className={themeColorClass} />
            ANALISIS PERFORMA PRODUKTIVITAS
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic mt-1">
            PERFORMA CABANG {branchLabel}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase mt-1">
            Periode Peninjauan Berdasarkan Cutoff Penjualan
          </p>
        </div>

        {/* TIME CYCLE CONTROLLER */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* MONTHLY / YEARLY TOGGLE */}
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button
              onClick={() => {
                setFilterType("monthly");
                setSelectedPeriodIndex(0);
              }}
              className={`px-4 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                filterType === "monthly"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => {
                setFilterType("yearly");
                setSelectedPeriodIndex(0);
              }}
              className={`px-4 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                filterType === "yearly"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Tahunan
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevPeriod}
              disabled={selectedPeriodIndex >= periods.length - 1}
              className="p-1.5 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
              title="Periode Sebelumnya"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center px-3 min-w-[150px]">
              <div className="text-xs font-black text-slate-800 uppercase tracking-tight">
                {activePeriod.label}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-0.5 font-mono leading-none">
                {activePeriod.subtext}
              </div>
            </div>
            <button
              onClick={handleNextPeriod}
              disabled={selectedPeriodIndex <= 0}
              className="p-1.5 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
              title="Periode Selanjutnya"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* HERO METRICS - KEY PERFORM METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Service */}
        <div id="stat-total" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
            <FileBarChart2 size={32} className="text-slate-300 transform -rotate-12 group-hover:text-slate-400 transition-all" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">TOTAL SERVIS SELESAI</span>
            <div className="text-5xl font-black text-slate-800 tracking-tight mt-1">
              {stats.totalSelesai}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[11px] text-slate-500 font-bold uppercase">
            <Info size={12} className="text-slate-400" />
            Eksklusi Unit Garansi
          </div>
        </div>

        {/* Berhasil */}
        <div id="stat-berhasil" className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 bg-emerald-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
            <CheckCircle2 size={32} className="text-emerald-300 transform -rotate-12 group-hover:text-emerald-400 transition-all" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase">TINGKAT KEBERHASILAN (SELESAI)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-5xl font-black text-emerald-600 tracking-tight">
                {stats.berhasilPct}%
              </div>
              <div className="text-lg font-bold text-slate-500">
                ({stats.berhasil} Unit)
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.berhasilPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Bermasalah */}
        <div id="stat-bermasalah" className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 bg-rose-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
            <XCircle size={32} className="text-rose-300 transform -rotate-12 group-hover:text-rose-400 transition-all" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-rose-500 uppercase">TINGKAT MASALAH (KENDALA)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-5xl font-black text-rose-600 tracking-tight">
                {stats.bermasalahPct}%
              </div>
              <div className="text-lg font-bold text-slate-500">
                ({stats.bermasalah} Unit)
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.bermasalahPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Garansi Auxiliary */}
        <div id="stat-garansi" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
            <Award size={32} className="text-amber-300 transform -rotate-12 group-hover:text-amber-400 transition-all" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-amber-500 uppercase">UNIT KLAIM GARANSI</span>
            <div className="text-5xl font-black text-amber-500 tracking-tight mt-1">
              {stats.garansi}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[11px] text-amber-600 font-bold uppercase bg-amber-50 px-2 py-1 rounded-lg w-fit">
            Garansi Toko Aktif
          </div>
        </div>
      </div>

      {/* CHARTS TREND & DISTRIBUTION ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (6 Months analysis) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-md font-black text-slate-800 uppercase tracking-tight">Tren Performa 6 Periode Terakhir</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Analisis pertumbuhan unit selesai dan kualitas follow up harian</p>
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSelesai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBerhasil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBermasalah" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#rose" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#rose" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }} stroke="#cbd5e1" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "15px", fill: "#64748b" }} />
                <Area type="monotone" dataKey="Total Servis" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSelesai)" />
                <Area type="monotone" dataKey="Selesai" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBerhasil)" />
                <Area type="monotone" dataKey="Bermasalah" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorBermasalah)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success vs Problem Distribution Pie */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-md font-black text-slate-800 uppercase tracking-tight">Distribusi Follow Up</h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Proporsi penyelesaian Selesai vs Kendala</p>
          </div>

          <div className="h-44 flex items-center justify-center relative">
            {stats.totalSelesai > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-350 text-xs font-bold uppercase tracking-wide">
                Tidak ada data periode ini
              </div>
            )}
            
            {stats.totalSelesai > 0 && (
              <div className="absolute text-center">
                <div className="text-2xl font-black text-slate-800">{stats.berhasilPct}%</div>
                <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Selesai</div>
              </div>
            )}
          </div>

          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Selesai (Selesai/Internal)</span>
              </div>
              <span className="font-black text-slate-900">{stats.berhasil} Unit</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600">Bermasalah (Kendala)</span>
              </div>
              <span className="font-black text-slate-900">{stats.bermasalah} Unit</span>
            </div>
          </div>
        </div>
      </div>

      {/* TEAM PERFORMANCE (ADMIN & MEKANIK PIC GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADMIN PERFORMANCE CARD */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-indigo-600" />
              <h3 className="text-md font-black text-slate-800 uppercase tracking-tight">KEDISIPLINAN SOP ADMIN</h3>
            </div>
            <p className="text-xs text-slate-400 font-bold mb-6">Penilaian ketepatan waktu antrian & follow up pelanggan</p>

            <div className="space-y-6">
              {/* Penalty 1: Telat Update Antrian */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-black text-slate-700 uppercase tracking-tight">
                    Telat Update Antrian
                  </div>
                  <div className={`px-2.5 py-1 text-xs font-black rounded-lg ${
                    stats.adminTelatUpdateAntrian > 0 
                      ? "bg-amber-100 text-amber-700" 
                      : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {stats.adminTelatUpdateAntrian} Unit Telat ({stats.totalProcessed > 0 ? Math.round((stats.adminTelatUpdateAntrian / stats.totalProcessed) * 100) : 0}%)
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.adminTelatUpdateAntrian > 0 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${stats.totalProcessed > 0 ? Math.round((stats.adminTelatUpdateAntrian / stats.totalProcessed) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-normal">
                  SOP: Admin wajib memperbarui antrian dari parkir/pendaftaran maksimal 15 menit.
                </p>
              </div>

              {/* Penalty 2: Telat Follow Up */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-black text-slate-700 uppercase tracking-tight">
                    Telat Follow Up
                  </div>
                  <div className={`px-2.5 py-1 text-xs font-black rounded-lg ${
                    stats.adminTelatFollowUp > 0 
                      ? "bg-rose-100 text-rose-700" 
                      : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {stats.adminTelatFollowUp} Unit Telat ({stats.totalProcessed > 0 ? Math.round((stats.adminTelatFollowUp / stats.totalProcessed) * 100) : 0}%)
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.adminTelatFollowUp > 0 ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${stats.totalProcessed > 0 ? Math.round((stats.adminTelatFollowUp / stats.totalProcessed) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-normal">
                  SOP: Admin wajib melakukan follow-up kepuasan pelanggan maksimal 5 hari setelah tiket muncul di kolom Follow Up (total maksimal 8 hari setelah unit diambil).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-3">
            <div className={`p-2 rounded-xl text-white ${
              (stats.adminTelatUpdateAntrian + stats.adminTelatFollowUp) > 0 ? "bg-amber-500" : "bg-emerald-500"
            }`}>
              <Check size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-800 uppercase">STATUS LAYANAN</div>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                {(stats.adminTelatUpdateAntrian + stats.adminTelatFollowUp) > 0
                  ? "Butuh Perbaikan Kecepatan Update"
                  : "Performa Sempurna Sesuai SLA"
                }
              </p>
            </div>
          </div>
        </div>

        {/* MEKANIK PIC PERFORMANCE SECTION */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award size={18} className="text-yellow-500" />
                <h3 className="text-md font-black text-slate-800 uppercase tracking-tight">KEDISIPLINAN SOP MEKANIK PIC</h3>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Metrik performa, klaim, dan kepatuhan SOP per mekanik</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {stats.mechanicPerformance.filter(m => m.active).length > 0 ? (
              stats.mechanicPerformance.map(m => (
                <div key={m.id} className="p-4 bg-slate-50/60 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center font-black text-slate-700 uppercase">
                      {m.name.substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        {m.name}
                        {m.complianceScore === 100 && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Perfect Score 🌟
                          </span>
                        )}
                      </h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                          Selesai: <b>{m.selesai} Unit</b>
                        </span>
                        {m.garansi > 0 && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                            Garansi: <b>{m.garansi} Unit</b>
                          </span>
                        )}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                          m.complianceScore >= 90 
                            ? "bg-emerald-50 text-emerald-600" 
                            : m.complianceScore >= 70 
                              ? "bg-amber-50 text-amber-600" 
                              : "bg-rose-50 text-rose-600"
                        }`}>
                          Kepatuhan SOP: {m.complianceScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Penalty stats list for each mechanic */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 bg-white px-3 py-2.5 rounded-xl border border-slate-100 sm:w-80 justify-start sm:justify-end text-[10px] font-bold">
                    <div className="flex items-center justify-between gap-1 w-full sm:w-auto">
                      <span className="text-slate-400 uppercase font-bold text-[9px]">Telat Update:</span>
                      <span className={`font-black ${m.telatUpdateService > 0 ? "text-amber-500 animate-pulse" : "text-slate-600"}`}>
                        {m.telatUpdateService} Unit
                      </span>
                    </div>

                    <div className="hidden sm:block text-slate-300">|</div>

                    <div className="flex items-center justify-between gap-1 w-full sm:w-auto">
                      <span className="text-slate-400 uppercase font-bold text-[9px]">Telat Selesai:</span>
                      <span className={`font-black ${m.telatUpdateSelesai > 0 ? "text-amber-500" : "text-slate-600"}`}>
                        {m.telatUpdateSelesai} Unit
                      </span>
                    </div>

                    <div className="hidden sm:block text-slate-300">|</div>

                    <div className="flex items-center justify-between gap-1 w-full sm:w-auto">
                      <span className="text-slate-400 uppercase font-bold text-[9px]">Resi Hilang:</span>
                      <span className={`font-black ${m.resiHilang > 0 ? "text-rose-500 font-bold" : "text-slate-600"}`}>
                        {m.resiHilang} Unit
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-slate-400 text-xs font-semibold uppercase">
                Tidak ada mekanik aktif dengan pencatatan unit siap pakai di periode {activePeriod.label}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
