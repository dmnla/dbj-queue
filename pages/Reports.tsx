import React, { useState, useMemo } from "react";
import {
  Ticket,
  TicketStatus,
  StorageSlot,
  StorageLog,
  Branch,
} from "../types";
import { formatTime } from "../services/ticketService";
import {
  Search,
  Calendar,
  Copy,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Filter,
  Warehouse,
  Wrench,
  Clock,
  Bike,
  AlertCircle,
  X,
  Image as ImageIcon,
} from "lucide-react";
import * as XLSX from "xlsx";

interface ReportsProps {
  tickets: Ticket[];
  storageSlots?: StorageSlot[];
  currentBranch?: Branch;
}

const Reports: React.FC<ReportsProps> = ({
  tickets,
  storageSlots = [],
  currentBranch,
}) => {
  const [activeTab, setActiveTab] = useState<"service" | "storage">("service");

  // --- SERVICE REPORT STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Semua Status");
  const [mechanicFilter, setMechanicFilter] = useState<string>("Semua Mekanik");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // --- STORAGE REPORT STATE ---
  const [storageSearch, setStorageSearch] = useState("");
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null,
  );
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- SERVICE LOGIC ---
  const mechanicsList = useMemo(() => {
    const mechs = new Set(
      tickets.map((t) => t.mechanic).filter((m): m is string => Boolean(m)),
    );
    return ["Semua Mekanik", ...Array.from(mechs)];
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          t.customerName.toLowerCase().includes(q) ||
          (t.ticketNumber && t.ticketNumber.includes(q)) ||
          t.id.toLowerCase().includes(q) ||
          t.unitSepeda.toLowerCase().includes(q);

        const matchesStatus =
          statusFilter === "Semua Status" ||
          (statusFilter === "Menunggu" && t.status === "waiting") ||
          (statusFilter === "Proses" &&
            (t.status === "active" || t.status === "pending")) ||
          (statusFilter === "Siap" && t.status === "ready") ||
          (statusFilter === "Follow Up" && t.status === "taken") ||
          (statusFilter === "Selesai" && t.status === "done") ||
          (statusFilter === "Batal" && t.status === "cancelled");

        const matchesMechanic =
          mechanicFilter === "Semua Mekanik" || t.mechanic === mechanicFilter;

        let matchesDate = true;
        if (startDate || endDate) {
          const ticketDate = new Date(t.timestamps.arrival).setHours(
            0,
            0,
            0,
            0,
          );
          const start = startDate
            ? new Date(startDate).setHours(0, 0, 0, 0)
            : null;
          const end = endDate ? new Date(endDate).setHours(0, 0, 0, 0) : null;
          if (start && ticketDate < start) matchesDate = false;
          if (end && ticketDate > end) matchesDate = false;
        }

        return matchesSearch && matchesStatus && matchesMechanic && matchesDate;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamps.arrival).getTime() -
          new Date(a.timestamps.arrival).getTime(),
      );
  }, [tickets, searchTerm, statusFilter, mechanicFilter, startDate, endDate]);

  const [servicePage, setServicePage] = useState(1);
  const [serviceLimit, setServiceLimit] = useState(15);
  React.useEffect(() => { setServicePage(1); }, [searchTerm, statusFilter, mechanicFilter, startDate, endDate]);

  const totalServicePages = Math.ceil(filteredTickets.length / serviceLimit);
  const displayedTickets = filteredTickets.slice((servicePage - 1) * serviceLimit, servicePage * serviceLimit);

  // --- STORAGE LOGIC (SESSIONS) ---
  interface StorageSession {
    id: string; // The storageTicketId
    currentSlot: string; // The *last* known slot
    customerName: string;
    bikeModel: string;
    checkInDate: string;
    checkOutDate: string | null;
    durationDays: number;
    status: "Active" | "Completed";
    logs: (StorageLog & { slotId: string })[]; // Flattened logs with slot source info
  }

  const storageSessions = useMemo(() => {
    // STRICT BRANCH CHECK
    if (currentBranch && currentBranch !== "pik") return [];

    // 1. Flatten all logs from all slots
    const allLogs: (StorageLog & { slotId: string })[] = [];
    storageSlots.forEach((slot) => {
      (slot.history || []).forEach((log) => {
        allLogs.push({ ...log, slotId: slot.id });
      });
    });

    // 2. Sort logs chronologically
    allLogs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // 3. Group by storageTicketId
    const groups: Record<string, (StorageLog & { slotId: string })[]> = {};

    allLogs.forEach((log) => {
      // If a log doesn't have a storageTicketId (legacy), we might need a fallback.
      const key =
        log.storageTicketId || `LEGACY_${log.slotId}_${log.timestamp}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    // 4. Transform groups into Sessions
    const sessions: StorageSession[] = Object.entries(groups).map(
      ([ticketId, logs]) => {
        const checkInLog = logs.find((l) => l.action === "check_in") || logs[0];

        const lastLog = logs[logs.length - 1];
        const isCompleted = lastLog.action === "checkout";

        let customerName = checkInLog.customerSnapshot?.name || "Unknown";
        let bikeModel = checkInLog.customerSnapshot?.bike || "Unknown";

        let currentSlotId = lastLog.slotId;
        if (!isCompleted) {
          const activeSlot = storageSlots.find(
            (s) => s.storageTicketId === ticketId,
          );
          if (activeSlot) {
            customerName = activeSlot.customerName || customerName;
            bikeModel = activeSlot.bikeModel || bikeModel;
            currentSlotId = activeSlot.id;
          }
        } else {
          if (lastLog.customerSnapshot) {
            customerName = lastLog.customerSnapshot.name;
            bikeModel = lastLog.customerSnapshot.bike;
          }
        }

        const checkInDate = checkInLog.timestamp;
        const checkOutDate = isCompleted ? lastLog.timestamp : null;

        const endT = checkOutDate
          ? new Date(checkOutDate).getTime()
          : new Date().getTime();
        const startT = new Date(checkInDate).getTime();
        const durationDays = Math.ceil((endT - startT) / (1000 * 3600 * 24));

        return {
          id: ticketId,
          currentSlot: currentSlotId,
          customerName,
          bikeModel,
          checkInDate,
          checkOutDate,
          durationDays,
          status: isCompleted ? "Completed" : "Active",
          logs: logs,
        };
      },
    );

    return sessions.sort(
      (a, b) =>
        new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime(),
    );
  }, [storageSlots, currentBranch]);

  const filteredStorageSessions = useMemo(() => {
    const q = storageSearch.toLowerCase();
    return storageSessions.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.currentSlot.toLowerCase().includes(q) ||
        s.bikeModel.toLowerCase().includes(q),
    );
  }, [storageSessions, storageSearch]);

  const [storagePage, setStoragePage] = useState(1);
  const [storageLimit, setStorageLimit] = useState(15);
  React.useEffect(() => { setStoragePage(1); }, [storageSearch]);

  const totalStoragePages = Math.ceil(filteredStorageSessions.length / storageLimit);
  const displayedStorageSessions = filteredStorageSessions.slice((storagePage - 1) * storageLimit, storagePage * storageLimit);

  const exportExcel = () => {
    if (activeTab === "service") {
      const data = filteredTickets.map((t) => ({
        "ID Tiket": t.id,
        "No Antrian": t.ticketNumber || "-",
        Pelanggan: t.customerName,
        Unit: t.unitSepeda,
        Layanan: t.serviceTypes.join(", "),
        Mekanik: t.mechanic || "-",
        Status: t.status.toUpperCase(),
        Datang: formatTime(t.timestamps.arrival),
        Mulai: formatTime(t.timestamps.called),
        Siap: formatTime(t.timestamps.ready),
        Ambil: formatTime(t.timestamps.taken || t.timestamps.finished),
        "Follow Up": t.followUpResult ? formatTime(t.timestamps.finished) : "-",
        Hasil: t.followUpResult || "-",
        Bukti: t.followUpPhotoUrl || "-",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Bengkel");
      XLSX.writeFile(wb, "DailyBike_Laporan_Bengkel.xlsx");
    } else {
      const data = filteredStorageSessions.map((s) => ({
        "Ticket ID": s.id,
        Slot: s.currentSlot,
        Customer: s.customerName,
        Bike: s.bikeModel,
        "Check In": formatTime(s.checkInDate),
        "Check Out": s.checkOutDate ? formatTime(s.checkOutDate) : "Active",
        "Duration (Days)": s.durationDays,
        Status: s.status,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Storage");
      XLSX.writeFile(wb, "DailyBike_Laporan_Storage.xlsx");
    }
  };

  const getTicketDurationString = (t: Ticket) => {
    let startTimeStr = t.lastStatusChange;
    if (!startTimeStr) {
      if (t.status === "waiting") {
        startTimeStr = t.timestamps.arrival;
      } else if (t.status === "active") {
        startTimeStr = t.timestamps.called || t.timestamps.arrival;
      } else if (t.status === "ready") {
        startTimeStr = t.timestamps.ready || t.timestamps.called || t.timestamps.arrival;
      } else if (t.status === "taken") {
        startTimeStr = t.timestamps.taken || t.timestamps.finished || t.timestamps.arrival;
      } else if (t.status === "done") {
        startTimeStr = t.timestamps.finished || t.timestamps.arrival;
      } else {
        startTimeStr = t.timestamps.arrival;
      }
    }

    const startMs = startTimeStr ? new Date(startTimeStr).getTime() : new Date().getTime();
    const diffMs = Math.max(0, new Date().getTime() - startMs);

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    const daysStr = String(days).padStart(2, "0");
    const hoursStr = String(hours).padStart(2, "0");

    return `${daysStr} Hari ${hoursStr} Jam`;
  };

  const copyWA = () => {
    if (activeTab === "service") {
      const today = new Date();
      const d = String(today.getDate()).padStart(2, "0");
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const y = today.getFullYear();
      const dateStr = `_${d}/${m}/${y}_`; // Italic date

      // --- LOGIC: USE ALL TICKETS, IGNORE FILTERS ---
      // Sort Priority: Ticket Number if exists, otherwise Arrival time
      const allTickets = [...tickets].sort((a, b) => {
        const numA = parseInt(a.ticketNumber || "0");
        const numB = parseInt(b.ticketNumber || "0");
        if (numA && numB) return numA - numB;
        return (
          new Date(a.timestamps.arrival).getTime() -
          new Date(b.timestamps.arrival).getTime()
        );
      });

      // 1. Active (Sedang Dikerjakan)
      const active = allTickets.filter((t) => t.status === "active");

      // 2. Pending (Tertunda)
      const pending = allTickets.filter((t) => t.status === "pending");

      // 3. Ready (Siap Diambil)
      const ready = allTickets.filter((t) => t.status === "ready");

      // 3a. Follow Up (Taken)
      const taken = allTickets.filter((t) => t.status === "taken");

      // 4. Waiting (Antrian Menunggu)
      const waiting = allTickets.filter((t) => t.status === "waiting");

      // 5. Finished Today (Selesai Hari Ini)
      const finishedToday = allTickets.filter((t) => {
        if (t.status !== "done" || !t.timestamps.finished) return false;
        const fDate = new Date(t.timestamps.finished);
        return (
          fDate.getDate() === today.getDate() &&
          fDate.getMonth() === today.getMonth() &&
          fDate.getFullYear() === today.getFullYear()
        );
      });

      let text = `*LAPORAN BENGKEL DAILY BIKE*\n${dateStr}\n\n`;

      const appendSection = (title: string, list: Ticket[]) => {
        if (list.length > 0) {
          text += `*${title}:*\n`;
          list.forEach((t) => {
            const services = t.serviceTypes.join(", ");
            const idDisplay = t.ticketNumber
              ? `[#${t.ticketNumber}]`
              : `[${t.id}]`;
            
            // Calculate time inside process
            const durationStr = getTicketDurationString(t);
            
            // Follow up info
            const followUpInfo = t.followUpResult ? ` - [Hasil Follow Up: ${t.followUpResult}]` : "";

            // Format: - [ID] NAME - UNIT - (SERVICES) - DD Hari HH Jam
            text += `- ${idDisplay} ${t.customerName.toUpperCase()} - ${t.unitSepeda.toUpperCase()} - (${services}) - ${durationStr}${followUpInfo}\n`;
          });
          text += `\n`; // Spacer
        }
      };

      appendSection("SEDANG DIKERJAKAN", active);
      appendSection("TERTUNDA (PENDING)", pending);
      appendSection("ANTRIAN MENUNGGU", waiting);
      appendSection("SIAP DIAMBIL", ready);
      appendSection("SELESAI HARI INI", finishedToday);
      appendSection("FOLLOW UP", taken);

      navigator.clipboard
        .writeText(text)
        .then(() => alert("Laporan WhatsApp berhasil disalin!"));
    } else {
      // Storage Copy
      const text = filteredStorageSessions
        .map(
          (s) =>
            `${s.currentSlot}: ${s.customerName} (${s.bikeModel}) - ${s.status}`,
        )
        .join("\n");
      navigator.clipboard
        .writeText(text)
        .then(() => alert("Data Storage disalin!"));
    }
  };

  const toggleRow = (sessionId: string) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-slate-800">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-800">
            LAPORAN & LOG
          </h1>
          <p className="text-slate-500 font-medium">
            Riwayat aktivitas layanan dan penyimpanan unit
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("service")}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm uppercase flex items-center gap-2 transition-all ${activeTab === "service" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-100"}`}
          >
            <Wrench size={16} /> Service
          </button>

          {/* HIDE STORAGE TAB IF NOT PIK */}
          {currentBranch === "pik" && (
            <button
              onClick={() => setActiveTab("storage")}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm uppercase flex items-center gap-2 transition-all ${activeTab === "storage" ? "bg-purple-600 text-white" : "bg-white text-slate-500 hover:bg-slate-100"}`}
            >
              <Warehouse size={16} /> Storage
            </button>
          )}
        </div>
      </div>

      {activeTab === "service" ? (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <Search size={12} /> Cari Pelanggan / ID / Sepeda
                </label>
                <input
                  type="text"
                  className="w-full pl-4 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ketik..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <Calendar size={12} /> Dari
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <Calendar size={12} /> Sampai
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <Filter size={12} /> Mekanik
                </label>
                <select
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                  value={mechanicFilter || ""}
                  onChange={(e) => setMechanicFilter(e.target.value)}
                >
                  {mechanicsList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <Filter size={12} /> Status
                </label>
                <select
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option>Semua Status</option>
                  <option value="Menunggu">Antri</option>
                  <option value="Proses">Proses</option>
                  <option value="Siap">Siap</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Batal">Batal</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={copyWA}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2"
            >
              <Copy size={14} /> Copy WA
            </button>
            <button
              onClick={exportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4">ID Tiket</th>
                    <th className="px-6 py-4">No. Antri</th>
                    <th className="px-6 py-4">Pelanggan</th>
                    <th className="px-6 py-4">Layanan</th>
                    <th className="px-6 py-4">Mekanik</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-blue-600">Datang</th>
                    <th className="px-6 py-4 text-indigo-600">Mulai</th>
                    <th className="px-6 py-4 text-emerald-600">Siap</th>
                    <th className="px-6 py-4 text-slate-800">Ambil</th>
                    <th className="px-6 py-4 text-purple-600 border-l border-slate-100">Follow Up</th>
                    <th className="px-6 py-4 text-orange-600">Hasil</th>
                    <th className="px-6 py-4 text-blue-600">Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedTickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                        {t.id}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">
                        {t.ticketNumber ? `#${t.ticketNumber}` : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-800">
                          {t.customerName}
                        </div>
                        <div className="text-[10px] text-blue-600 font-bold">
                          {t.unitSepeda}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                        {t.serviceTypes.join(", ")}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-600">
                        {t.mechanic || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase">
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {formatTime(t.timestamps.arrival)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {formatTime(t.timestamps.called)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {formatTime(t.timestamps.ready)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {formatTime(t.timestamps.taken || t.timestamps.finished)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono border-l border-slate-100">
                        {t.followUpResult ? formatTime(t.timestamps.finished) : "-"}
                      </td>
                      <td className="px-6 py-4">
                        {t.followUpResult ? (
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase text-center ${
                            t.followUpResult === 'Selesai' || t.followUpResult === 'Berhasil'
                              ? 'bg-green-100 text-green-700'
                              : t.followUpResult === 'Kendala'
                              ? 'bg-red-100 text-red-700'
                              : t.followUpResult === 'Tidak Respond'
                              ? 'bg-amber-100 text-amber-700'
                              : t.followUpResult === 'Milik Internal'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.followUpResult}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {t.followUpPhotoUrl ? (
                          <div className="flex justify-center flex-col items-center gap-1">
                            <button
                              onClick={() => setPreviewImage(t.followUpPhotoUrl!)}
                              className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg overflow-hidden border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95"
                              title="Klik untuk perbesar"
                            >
                              <img 
                                src={t.followUpPhotoUrl} 
                                alt="Screenshot" 
                                className="w-12 h-12 object-cover"
                              />
                            </button>
                            <a 
                              href={t.followUpPhotoUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-bold hover:underline"
                              title="Unduh/Buka Tab Baru"
                            >
                              Buka Link
                            </a>
                          </div>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* SERVICE PAGINATION */}
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-white border-t border-slate-100 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Tampil</span>
                <select
                  className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={serviceLimit}
                  onChange={(e) => setServiceLimit(Number(e.target.value))}
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs font-bold text-slate-500 uppercase">per halaman</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServicePage(p => Math.max(1, p - 1))}
                  disabled={servicePage === 1}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${servicePage === 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                >
                  Prev
                </button>
                <span className="text-xs font-bold text-slate-600">
                  Hal {servicePage} dari {totalServicePages || 1}
                </span>
                <button
                  onClick={() => setServicePage(p => Math.min(totalServicePages, p + 1))}
                  disabled={servicePage === totalServicePages || totalServicePages === 0}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${servicePage === totalServicePages || totalServicePages === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* STORAGE REPORT UI */}
          {currentBranch !== "pik" ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <AlertCircle size={48} className="mx-auto mb-4 text-slate-300" />
              <h2 className="text-xl font-bold text-slate-600 uppercase">
                Laporan Storage Tidak Tersedia
              </h2>
              <p className="text-slate-400 mt-2">
                Fitur Storage hanya tersedia untuk cabang PIK 2.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">
                      <Search size={12} /> Cari Tiket / Pelanggan / Slot / Unit
                    </label>
                    <input
                      type="text"
                      className="w-full pl-4 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Ketik pencarian..."
                      value={storageSearch}
                      onChange={(e) => setStorageSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mb-4">
                <button
                  onClick={exportExcel}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2"
                >
                  <FileSpreadsheet size={14} /> Export Excel (Filtered)
                </button>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-purple-50 border-b border-purple-100 text-[10px] font-black uppercase tracking-widest text-purple-400">
                        <th className="w-10"></th>
                        <th className="px-6 py-4">Ticket ID</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Unit</th>
                        <th className="px-6 py-4">Slot (Current)</th>
                        <th className="px-6 py-4">Check In</th>
                        <th className="px-6 py-4">Check Out</th>
                        <th className="px-6 py-4">Durasi</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedStorageSessions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-6 py-12 text-center text-slate-400 italic"
                          >
                            Belum ada data sesi storage.
                          </td>
                        </tr>
                      ) : (
                        displayedStorageSessions.map((s) => (
                          <React.Fragment key={s.id}>
                            <tr
                              className={`cursor-pointer transition-colors ${expandedSessionId === s.id ? "bg-purple-50" : "hover:bg-purple-50/30"}`}
                              onClick={() => toggleRow(s.id)}
                            >
                              <td className="px-4 py-4 text-purple-400">
                                {expandedSessionId === s.id ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-purple-600">
                                {s.id}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-700">
                                {s.customerName}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 uppercase">
                                {s.bikeModel}
                              </td>
                              <td className="px-6 py-4 font-mono font-black text-slate-400">
                                {s.currentSlot}
                              </td>
                              <td className="px-6 py-4 text-xs font-mono text-slate-600">
                                {formatTime(s.checkInDate)}
                              </td>
                              <td className="px-6 py-4 text-xs font-mono text-slate-600">
                                {s.checkOutDate
                                  ? formatTime(s.checkOutDate)
                                  : "-"}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                {s.durationDays} Hari
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`px-2 py-1 rounded text-[10px] font-black uppercase ${s.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                                >
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                            {expandedSessionId === s.id && (
                              <tr className="bg-slate-50/50 shadow-inner">
                                <td colSpan={9} className="px-6 py-6">
                                  {/* TIMELINE STYLE LOGS */}
                                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-2 pl-4">
                                    {[...s.logs]
                                      .reverse()
                                      .map(
                                        (
                                          log: StorageLog & { slotId: string },
                                        ) => (
                                          <div
                                            key={log.id}
                                            className="relative"
                                          >
                                            <div
                                              className={`absolute -left-[23px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${log.action === "check_in" ? "bg-purple-500" : log.action === "ride_out" ? "bg-yellow-500" : log.action === "ride_return" ? "bg-green-500" : log.action === "extend" ? "bg-blue-500" : "bg-slate-500"}`}
                                            ></div>

                                            <div className="flex justify-between items-start">
                                              <div className="flex flex-col">
                                                <div className="text-xs text-slate-400 font-mono mb-1">
                                                  {formatTime(log.timestamp)}
                                                </div>
                                                <span className="text-[10px] bg-slate-200 px-1 rounded font-mono text-slate-600 mb-1 inline-block w-fit">
                                                  Slot: {log.slotId}
                                                </span>
                                              </div>
                                              <div
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${log.action === "check_in" ? "bg-purple-100 text-purple-700" : log.action === "ride_out" ? "bg-yellow-100 text-yellow-700" : log.action === "ride_return" ? "bg-green-100 text-green-700" : log.action === "extend" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}
                                              >
                                                {log.action.replace("_", " ")}
                                              </div>
                                            </div>

                                            <div className="bg-white p-3 rounded-xl border border-slate-200 mt-1 shadow-sm">
                                              {log.notes && (
                                                <p className="text-sm text-slate-700 italic mb-2">
                                                  "{log.notes}"
                                                </p>
                                              )}
                                              {((log.photos && log.photos.length > 0) || (log as any).photo) && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                  {(log.photos || [(log as any).photo]).map((photo, pIndex) => (
                                                    <img
                                                      key={pIndex}
                                                      src={photo}
                                                      alt={`Bukti ${pIndex + 1}`}
                                                      className="w-24 h-24 object-cover rounded-lg border border-slate-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                                                      onClick={() => setPreviewImage(photo)}
                                                    />
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ),
                                      )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* STORAGE PAGINATION */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-white border-t border-slate-100 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400 uppercase">Tampil</span>
                    <select
                      className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={storageLimit}
                      onChange={(e) => setStorageLimit(Number(e.target.value))}
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-xs font-bold text-purple-400 uppercase">per halaman</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStoragePage(p => Math.max(1, p - 1))}
                      disabled={storagePage === 1}
                      className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${storagePage === 1 ? 'bg-purple-50 text-purple-300 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                      Prev
                    </button>
                    <span className="text-xs font-bold text-slate-600">
                      Hal {storagePage} dari {totalStoragePages || 1}
                    </span>
                    <button
                      onClick={() => setStoragePage(p => Math.min(totalStoragePages, p + 1))}
                      disabled={storagePage === totalStoragePages || totalStoragePages === 0}
                      className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${storagePage === totalStoragePages || totalStoragePages === 0 ? 'bg-purple-50 text-purple-300 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                      Next
                    </button>
                  </div>
                </div>

              </div>
            </>
          )}
        </>
      )}

      {/* Image Preview Overlay */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage || ""}
            alt="Full View"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button className="absolute top-4 right-4 text-white hover:text-slate-300">
            <X size={32} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Reports;
