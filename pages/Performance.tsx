import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Ticket, Branch, MechanicDefinition, flag_type } from "../types";
import { calculateTicketTimers } from "../services/ticketService";
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
  FileBarChart2,
  Wrench,
  X,
  Search,
  Eye,
  Zap,
  FileSpreadsheet,
  ClipboardCheck,
  Users,
  FileCheck2,
  ExternalLink
} from "lucide-react";
import MonthlyReconciliationTab from "../components/MonthlyReconciliationTab";

/**
 * Calculates active working time in milliseconds between two timestamps.
 * Active working hours: 08:00 to 17:00 (5 PM to 8 AM next day excluded).
 */
export const calculateActiveWorkingMs = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;

  let totalActiveMs = 0;

  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (current <= lastDay) {
    const y = current.getFullYear();
    const m = current.getMonth();
    const d = current.getDate();

    const dayActiveStart = new Date(y, m, d, 8, 0, 0, 0).getTime();
    const dayActiveEnd = new Date(y, m, d, 17, 0, 0, 0).getTime();

    const overlapStart = Math.max(start.getTime(), dayActiveStart);
    const overlapEnd = Math.min(end.getTime(), dayActiveEnd);

    if (overlapEnd > overlapStart) {
      totalActiveMs += (overlapEnd - overlapStart);
    }

    current.setDate(current.getDate() + 1);
  }

  return totalActiveMs;
};

/**
 * Formats active working duration into total hours and minutes (e.g., "145 Jam 20 Menit" or "0 Jam 45 Menit").
 */
export const formatActiveDuration = (ms: number): string => {
  if (isNaN(ms) || ms <= 0) return "0 Jam 00 Menit";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${hours} Jam ${pad(minutes)} Menit`;
};
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
  const [activeTab, setActiveTab] = useState<"operational" | "mechanics" | "reconciliation">("operational");

  // Popout modal states for mechanic service & kendala
  const [activeServiceModal, setActiveServiceModal] = useState<{
    mechanicName: string;
    serviceName: string;
    avgSpeedStr: string;
    ticketItems: Array<{
      ticket: Ticket;
      mulaiStr: string;
      readyStr: string;
      activeMs: number;
      activeDurationStr: string;
      activeTimerStr: string;
      pauseTimerStr: string;
    }>;
  } | null>(null);

  const [activeKendalaModal, setActiveKendalaModal] = useState<{
    mechanicName: string;
    tickets: Ticket[];
  } | null>(null);

  const [activeTicketListModal, setActiveTicketListModal] = useState<{
    title: string;
    subtitle?: string;
    badgeText?: string;
    category: "success" | "danger" | "warning" | "info" | "primary";
    tickets: Ticket[];
  } | null>(null);

  const [modalSearchTerm, setModalSearchTerm] = useState<string>("");

  const isMK = currentBranch === "mk";
  const branchLabel = isMK ? "Muara Karang" : "PIK 2";
  const themeColorClass = isMK ? "text-blue-600" : "text-emerald-600";
  const themeBgClass = isMK ? "bg-blue-600" : "bg-emerald-600";
  const themeBorderClass = isMK ? "border-blue-500" : "border-emerald-500";

  // Date generators
  const monthlyPeriods = useMemo(() => {
    const result: Period[] = [];
    const today = new Date();
    let latestMonth = today.getMonth(); // 0-indexed
    let latestYear = today.getFullYear();

    if (today.getDate() >= 29) {
      latestMonth += 1;
      if (latestMonth > 11) {
        latestMonth = 0;
        latestYear += 1;
      }
    }

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
      let m = latestMonth - i;
      let y = latestYear;
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
    let latestYear = today.getFullYear();

    if (today.getMonth() === 11 && today.getDate() >= 29) {
      latestYear += 1;
    }

    for (let i = 0; i < 3; i++) {
      const y = latestYear - i;
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

    const totalSelesaiTickets = filtered.filter(t => !isGaransiTicket(t));
    const berhasilTickets = filtered.filter(t => isBerhasilTicket(t));
    const bermasalahTickets = filtered.filter(t => isBermasalahTicket(t));
    const garansiTickets = filtered.filter(t => isGaransiTicket(t));

    const totalSelesai = totalSelesaiTickets.length;
    const berhasil = berhasilTickets.length;
    const bermasalah = bermasalahTickets.length;
    const garansi = garansiTickets.length;

    const berhasilPct = totalSelesai > 0 ? Math.round((berhasil / totalSelesai) * 100) : 0;
    const bermasalahPct = totalSelesai > 0 ? Math.round((bermasalah / totalSelesai) * 100) : 0;

    // Admin penalties calculated from filtered (truly done tickets)
    const adminTelatUpdateAntrianTickets = filtered.filter(t => 
      t.flags?.some(f2 => (f2 as any) === "TELAT_UPDATE_ANTRIAN" || (f2 as any) === "TELAT_UPDATE")
    );
    const adminTelatUpdateAntrian = adminTelatUpdateAntrianTickets.length;

    const adminTelatFollowUpTickets = filtered.filter(t => 
      t.flags?.some(f2 => (f2 as any) === "TELAT_FOLLOW_UP" || (f2 as any) === "LATE_FOLLOW_UP")
    );
    const adminTelatFollowUp = adminTelatFollowUpTickets.length;

    // Helper to determine the single last assigned mechanic for a ticket
    const getFinalMechanic = (t: Ticket): string => {
      const mech = (t.overtimeMechanic && t.overtimeMechanic.trim()) ? t.overtimeMechanic.trim() : (t.mechanic ? t.mechanic.trim() : "");
      return mech.toUpperCase();
    };

    // Mechanics list calculated from filtered (truly done tickets)
    // Counts cards strictly for the last assigned mechanic (overtimeMechanic if changed during lembur, else mechanic)
    const mechanicPerformance = mechanics.map(m => {
      const nameUpper = m.name.trim().toUpperCase();
      const picTickets = filtered.filter(t => {
        const assignedUpper = getFinalMechanic(t);
        return assignedUpper === nameUpper || assignedUpper === m.id.toUpperCase();
      });

      const selesaiTickets = picTickets.filter(t => !isGaransiTicket(t));
      const garansiTickets = picTickets.filter(t => isGaransiTicket(t));
      const selesaiPicCount = selesaiTickets.length;
      const garansiPicCount = garansiTickets.length;

      const telatUpdateServiceTickets = picTickets.filter(t => 
        t.flags?.includes("TELAT_UPDATE_SERVICE" as any)
      );
      const telatUpdateService = telatUpdateServiceTickets.length;

      const telatUpdateSelesaiTickets = picTickets.filter(t => 
        t.flags?.includes("TELAT_UPDATE_SELESAI" as any)
      );
      const telatUpdateSelesai = telatUpdateSelesaiTickets.length;

      const resiHilangTickets = picTickets.filter(t => 
        t.flags?.includes("RESI_HILANG" as any)
      );
      const resiHilang = resiHilangTickets.length;

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
        complianceScore,
        picTickets,
        selesaiTickets,
        garansiTickets,
        telatUpdateServiceTickets,
        telatUpdateSelesaiTickets,
        resiHilangTickets
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
      totalProcessed: filtered.length,
      totalSelesaiTickets,
      berhasilTickets,
      bermasalahTickets,
      garansiTickets,
      adminTelatUpdateAntrianTickets,
      adminTelatFollowUpTickets,
      filteredTickets: filtered
    };
  }, [activePeriod, tickets, mechanics, currentBranch]);

  // Filtered tickets inside the activeTicketListModal for search
  const filteredModalTickets = useMemo(() => {
    if (!activeTicketListModal) return [];
    if (!modalSearchTerm.trim()) return activeTicketListModal.tickets;
    const q = modalSearchTerm.toLowerCase();
    return activeTicketListModal.tickets.filter(t => {
      const cust = (t.customerName || "").toLowerCase();
      const phone = (t.phone || "").toLowerCase();
      const bike = (t.unitSepeda || "").toLowerCase();
      const tNum = (t.ticketNumber || "").toLowerCase();
      const dpNum = (t.dealposOrderNumber || "").toLowerCase();
      const mech = (t.overtimeMechanic || t.mechanic || "").toLowerCase();
      const notes = (t.notes || "").toLowerCase();
      const res = (t.followUpResult || "").toLowerCase();
      const services = (t.serviceTypes || []).join(" ").toLowerCase();
      const flags = (t.flags || []).join(" ").toLowerCase();

      return (
        cust.includes(q) ||
        phone.includes(q) ||
        bike.includes(q) ||
        tNum.includes(q) ||
        dpNum.includes(q) ||
        mech.includes(q) ||
        notes.includes(q) ||
        res.includes(q) ||
        services.includes(q) ||
        flags.includes(q)
      );
    });
  }, [activeTicketListModal, modalSearchTerm]);

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

  // Compile Mechanic Service Performance (Speed per Layanan & Kendala)
  const mechanicServicePerformance = useMemo(() => {
    const start = activePeriod.startDate;
    const end = activePeriod.endDate;

    // Filter tickets in active period for current branch
    // Based on tanggal siap / jam siap (timestamps.ready)
    const periodTickets = tickets.filter(t => {
      if (t.branch !== currentBranch) return false;
      if (t.status === "cancelled") return false;

      const readyDateStr = t.timestamps?.ready;
      if (!readyDateStr) return false;

      const readyDate = new Date(readyDateStr);
      if (isNaN(readyDate.getTime())) return false;

      return readyDate >= start && readyDate <= end;
    });

    // Helper to determine the single last assigned mechanic for a ticket
    const getFinalMechanic = (t: Ticket): string => {
      const mech = (t.overtimeMechanic && t.overtimeMechanic.trim()) ? t.overtimeMechanic.trim() : (t.mechanic ? t.mechanic.trim() : "");
      return mech.toUpperCase();
    };

    // Get mechanics relevant to current branch or period tickets
    const relevantMechanics = mechanics.filter(m => {
      const isBranch = m.branches && m.branches.includes(currentBranch);
      const nameUpper = m.name.trim().toUpperCase();
      const hasTickets = periodTickets.some(t => {
        const assignedUpper = getFinalMechanic(t);
        return assignedUpper === nameUpper || assignedUpper === m.id.toUpperCase();
      });
      return isBranch || hasTickets;
    });

    return relevantMechanics.map(m => {
      const nameUpper = m.name.trim().toUpperCase();

      const mechTickets = periodTickets.filter(t => {
        const assignedUpper = getFinalMechanic(t);
        return assignedUpper === nameUpper || assignedUpper === m.id.toUpperCase();
      });

      let kendalaCount = 0;
      let berhasilCount = 0;

      mechTickets.forEach(t => {
        const res = t.followUpResult ? t.followUpResult.trim().toUpperCase() : "";
        if (res === "KENDALA") {
          kendalaCount++;
        } else if (res === "SELESAI" || res === "BERHASIL" || res === "TIDAK RESPOND" || res === "MILIK INTERNAL") {
          berhasilCount++;
        } else if (res !== "") {
          berhasilCount++;
        } else if (t.status === "done" || t.status === "ready" || t.status === "taken") {
          berhasilCount++;
        }
      });

      const kendalaTickets = mechTickets.filter(t => t.followUpResult?.trim().toUpperCase() === "KENDALA");

      const ticketDetails: Array<{
        ticket: Ticket;
        mulaiStr: string;
        readyStr: string;
        activeSeconds: number;
        pauseSeconds: number;
        speedMs: number;
        activeTimerStr: string;
        pauseTimerStr: string;
        durasiPengerjaanStr: string;
      }> = [];

      const serviceMap: {
        [serviceName: string]: {
          totalMs: number;
          count: number;
          ticketItems: Array<{
            ticket: Ticket;
            mulaiStr: string;
            readyStr: string;
            activeMs: number;
            activeDurationStr: string;
            activeTimerStr: string;
            pauseTimerStr: string;
          }>;
        };
      } = {};
      let totalSpeedMsAll = 0;
      let totalReadyTicketsCount = 0;
      let totalEfektifActiveSec = 0;

      mechTickets.forEach(t => {
        const mulaiStr = t.timestamps?.called || t.timestamps?.arrival || "";
        const readyStr = t.timestamps?.ready || "";

        const { activeSeconds, pauseSeconds } = calculateTicketTimers(t);

        // Fallback for legacy tickets without timer tracking
        let effectiveSecForTicket = activeSeconds;
        let pauseSecForTicket = pauseSeconds;

        if (effectiveSecForTicket === 0 && pauseSecForTicket === 0 && (mulaiStr && readyStr)) {
          effectiveSecForTicket = Math.floor(calculateActiveWorkingMs(mulaiStr, readyStr) / 1000);
        }

        // Jam kerja efektif = total sum of activeTimer for all cards for each mechanic
        totalEfektifActiveSec += effectiveSecForTicket;

        // Speed is counted based on activeTimer + pauseTimer
        const totalTimerSeconds = activeSeconds + pauseSeconds;
        let speedMs = totalTimerSeconds * 1000;

        if (speedMs === 0 && (mulaiStr && readyStr)) {
          speedMs = calculateActiveWorkingMs(mulaiStr, readyStr);
        }

        const activeDurationStr = formatActiveDuration(speedMs);
        const activeTimerStr = formatActiveDuration(effectiveSecForTicket * 1000);
        const pauseTimerStr = formatActiveDuration(pauseSecForTicket * 1000);

        ticketDetails.push({
          ticket: t,
          mulaiStr,
          readyStr,
          activeSeconds: effectiveSecForTicket,
          pauseSeconds: pauseSecForTicket,
          speedMs,
          activeTimerStr,
          pauseTimerStr,
          durasiPengerjaanStr: activeDurationStr
        });

        if (speedMs > 0 || (mulaiStr && readyStr)) {
          totalSpeedMsAll += speedMs;
          totalReadyTicketsCount++;

          const serviceList = (t.serviceTypes && t.serviceTypes.length > 0)
            ? t.serviceTypes
            : ["Servis Umum"];

          serviceList.forEach(sName => {
            const cleanName = sName.trim() || "Servis Umum";
            if (!serviceMap[cleanName]) {
              serviceMap[cleanName] = { totalMs: 0, count: 0, ticketItems: [] };
            }
            serviceMap[cleanName].totalMs += speedMs;
            serviceMap[cleanName].count += 1;
            serviceMap[cleanName].ticketItems.push({
              ticket: t,
              mulaiStr,
              readyStr,
              activeMs: speedMs,
              activeDurationStr,
              activeTimerStr,
              pauseTimerStr
            });
          });
        }
      });

      const services = Object.keys(serviceMap).map(sName => {
        const item = serviceMap[sName];
        const avgMs = item.count > 0 ? item.totalMs / item.count : 0;
        return {
          serviceName: sName,
          count: item.count,
          avgMs,
          speedStr: formatActiveDuration(avgMs),
          ticketItems: item.ticketItems
        };
      }).sort((a, b) => b.count - a.count);

      const overallAvgMs = totalReadyTicketsCount > 0 ? totalSpeedMsAll / totalReadyTicketsCount : 0;
      const overallSpeedStr = formatActiveDuration(overallAvgMs);
      const jamKerjaEfektifStr = formatActiveDuration(totalEfektifActiveSec * 1000);

      return {
        id: m.id,
        name: m.name,
        totalTickets: mechTickets.length,
        berhasilCount,
        kendalaCount,
        kendalaTickets,
        services,
        overallSpeedStr,
        jamKerjaEfektifStr,
        totalEfektifActiveSec,
        ticketDetails
      };
    }).sort((a, b) => b.totalTickets - a.totalTickets);
  }, [mechanics, tickets, activePeriod, currentBranch]);

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

  // Helper date formatter for export
  const formatExportDT = (dtStr?: string) => {
    if (!dtStr) return "-";
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detail Performa Mekanik
    const rows: any[][] = [];

    // Header metadata
    rows.push([`LAPORAN PERFORMA SERVIS MEKANIK - DAILY BIKE`]);
    rows.push([`Cabang: ${branchLabel.toUpperCase()}`]);
    rows.push([`Periode: ${activePeriod.label} (${activePeriod.subtext})`]);
    rows.push([]); // blank row

    mechanicServicePerformance.forEach((m) => {
      // Mechanic Section Header
      rows.push([
        `MEKANIK: ${m.name.toUpperCase()}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        `TOTAL JAM KERJA EFEKTIF: ${m.jamKerjaEfektifStr}`
      ]);

      // Table Column Headers
      rows.push([
        "No",
        "Nama Mekanik",
        "Kontak & Pelanggan",
        "Sepeda / Unit",
        "Layanan / Servis",
        "Jam Mulai",
        "Jam Siap",
        "Active Timer",
        "Pause Timer",
        "Durasi Pengerjaan"
      ]);

      if (m.ticketDetails.length === 0) {
        rows.push(["-", m.name, "Tidak ada pengerjaan unit pada periode ini", "-", "-", "-", "-", "-", "-", "-"]);
      } else {
        m.ticketDetails.forEach((td, idx) => {
          const contactStr = `${td.ticket.customerName || "-"} (${td.ticket.phone || "-"})`;
          const serviceStr = (td.ticket.serviceTypes && td.ticket.serviceTypes.length > 0)
            ? td.ticket.serviceTypes.join(", ")
            : "Servis Umum";

          rows.push([
            idx + 1,
            m.name,
            contactStr,
            td.ticket.unitSepeda || "-",
            serviceStr,
            formatExportDT(td.mulaiStr),
            formatExportDT(td.readyStr),
            td.activeTimerStr,
            td.pauseTimerStr,
            td.durasiPengerjaanStr
          ]);
        });
      }

      // Mechanic Subtotal Row
      rows.push([
        "TOTAL",
        m.name,
        `Total Pengerjaan: ${m.ticketDetails.length} Unit`,
        "",
        "",
        "",
        "TOTAL ACTIVE TIMER:",
        m.jamKerjaEfektifStr,
        "",
        `Rata-Rata Speed: ${m.overallSpeedStr}`
      ]);

      // Spacing rows between mechanics
      rows.push([]);
      rows.push([]);
    });

    const wsDetail = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    wsDetail["!cols"] = [
      { wch: 6 },  // No
      { wch: 18 }, // Nama Mekanik
      { wch: 30 }, // Kontak & Pelanggan
      { wch: 24 }, // Sepeda / Unit
      { wch: 28 }, // Layanan / Servis
      { wch: 20 }, // Jam Mulai
      { wch: 20 }, // Jam Siap
      { wch: 16 }, // Active Timer
      { wch: 16 }, // Pause Timer
      { wch: 18 }  // Durasi Pengerjaan
    ];

    XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Performa Mekanik");

    // Sheet 2: Ringkasan Performa Mekanik
    const summaryRows: any[][] = [
      [`RINGKASAN PERFORMA MEKANIK - CABANG ${branchLabel.toUpperCase()}`],
      [`Periode: ${activePeriod.label} (${activePeriod.subtext})`],
      [],
      [
        "No",
        "Nama Mekanik",
        "Total Unit Servis",
        "Total Jam Kerja Efektif",
        "Rata-Rata Kecepatan / Unit",
        "Servis Berhasil",
        "Servis Kendala"
      ]
    ];

    mechanicServicePerformance.forEach((m, idx) => {
      summaryRows.push([
        idx + 1,
        m.name,
        m.totalTickets,
        m.jamKerjaEfektifStr,
        m.overallSpeedStr,
        m.berhasilCount,
        m.kendalaCount
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 18 },
      { wch: 24 },
      { wch: 26 },
      { wch: 16 },
      { wch: 16 }
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Mekanik");

    const safeBranch = currentBranch.toUpperCase();
    const safePeriod = activePeriod.label.replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(wb, `DailyBike_Performa_Mekanik_${safeBranch}_${safePeriod}.xlsx`);
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

      {/* DOMAIN NAVIGATION TAB SWITCHER */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("operational")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "operational"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <ClipboardCheck size={16} className={activeTab === "operational" ? themeColorClass : "text-slate-400"} />
            <span>Kualitas & SOP Operasional</span>
          </button>

          <button
            onClick={() => setActiveTab("mechanics")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "mechanics"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <Users size={16} className={activeTab === "mechanics" ? themeColorClass : "text-slate-400"} />
            <span>Produktivitas & Jam Kerja Mekanik</span>
          </button>

          <button
            onClick={() => setActiveTab("reconciliation")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "reconciliation"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <FileCheck2 size={16} className={activeTab === "reconciliation" ? "text-emerald-600" : "text-slate-400"} />
            <span>Rekonsiliasi & Rekap WhatsApp</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-bold flex items-center gap-1.5 self-end lg:self-center">
          <Info size={14} className="text-slate-400" />
          {activeTab === "operational" ? (
            <span>Basis Data: <b>Follow-Up Tiket Selesai</b> (Locked / Final)</span>
          ) : activeTab === "mechanics" ? (
            <span>Basis Data: <b>Tanggal Unit Siap</b> (Cut-off 29 s/d 28)</span>
          ) : (
            <span>Basis Data: <b>Justifikasi Masalah & Laporan Final WhatsApp</b></span>
          )}
        </div>
      </div>

      {/* TAB 1: KUALITAS & SOP OPERASIONAL */}
      {activeTab === "operational" && (
        <div className="space-y-8 animate-fadeIn">
          {/* RECONCILIATION ANNOUNCEMENT / SHORTCUT BANNER */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-3xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-emerald-900/40">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 shrink-0 border border-emerald-500/30">
                <FileCheck2 size={22} />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                  <span>Rekonsiliasi Masalah Bulanan & Rekap WhatsApp</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px]">Tersedia</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Ada temuan telat antrian, telat follow-up, atau resi hilang yang punya alasan sah? Berikan dispensasi (write-off) untuk evaluasi bersih dan salin format WhatsApp.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("reconciliation")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap self-end sm:self-auto cursor-pointer shadow-xs hover:scale-105"
            >
              <span>Buka Rekonsiliasi</span>
              <ExternalLink size={14} />
            </button>
          </div>

          {/* HERO METRICS - KEY PERFORM METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Service */}
        <div 
          id="stat-total" 
          onClick={() => {
            setModalSearchTerm("");
            setActiveTicketListModal({
              title: "Daftar Tiket: Total Servis Selesai",
              subtitle: `Seluruh unit servis selesai (eksklusi garansi) pada periode ${activePeriod.label}`,
              badgeText: `${stats.totalSelesai} Unit`,
              category: "info",
              tickets: stats.totalSelesaiTickets
            });
          }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
          title="Klik untuk melihat daftar seluruh unit servis selesai"
        >
          <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
            <FileBarChart2 size={32} className="text-slate-300 transform -rotate-12 group-hover:text-indigo-400 transition-all" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-slate-400 group-hover:text-indigo-600 uppercase transition-colors">TOTAL SERVIS SELESAI</span>
            <div className="text-5xl font-black text-slate-800 group-hover:text-indigo-950 tracking-tight mt-1 transition-colors">
              {stats.totalSelesai}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1 text-slate-500 font-bold uppercase">
              <Info size={12} className="text-slate-400" />
              Eksklusi Unit Garansi
            </div>
            <span className="text-indigo-600 font-black text-[10px] flex items-center gap-1 group-hover:underline">
              Lihat Kartu <Eye size={12} />
            </span>
          </div>
        </div>

        {/* Berhasil */}
        <div 
          id="stat-berhasil" 
          onClick={() => {
            setModalSearchTerm("");
            setActiveTicketListModal({
              title: "Daftar Unit Selesai (Tingkat Keberhasilan)",
              subtitle: `Unit berhasil diselesaikan & follow up tuntas pada periode ${activePeriod.label}`,
              badgeText: `${stats.berhasil} Unit`,
              category: "success",
              tickets: stats.berhasilTickets
            });
          }}
          className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
          title="Klik untuk melihat daftar unit berhasil selesai"
        >
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
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex-1">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.berhasilPct}%` }}></div>
            </div>
            <span className="text-emerald-700 font-black text-[10px] flex items-center gap-1 shrink-0 group-hover:underline">
              Lihat Kartu <Eye size={12} />
            </span>
          </div>
        </div>

        {/* Bermasalah */}
        <div 
          id="stat-bermasalah" 
          onClick={() => {
            setModalSearchTerm("");
            setActiveTicketListModal({
              title: "Daftar Unit Masalah (Kendala)",
              subtitle: `Unit dengan catatan kendala follow up pada periode ${activePeriod.label}`,
              badgeText: `${stats.bermasalah} Unit`,
              category: "danger",
              tickets: stats.bermasalahTickets
            });
          }}
          className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md hover:border-rose-300 transition-all cursor-pointer"
          title="Klik untuk melihat daftar unit bermasalah / kendala"
        >
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
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex-1">
              <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.bermasalahPct}%` }}></div>
            </div>
            <span className="text-rose-700 font-black text-[10px] flex items-center gap-1 shrink-0 group-hover:underline">
              Lihat Kartu <Eye size={12} />
            </span>
          </div>
        </div>

        {/* Garansi Auxiliary */}
        <div 
          id="stat-garansi" 
          onClick={() => {
            setModalSearchTerm("");
            setActiveTicketListModal({
              title: "Daftar Unit Klaim Garansi",
              subtitle: `Unit dengan klaim garansi toko aktif pada periode ${activePeriod.label}`,
              badgeText: `${stats.garansi} Unit`,
              category: "warning",
              tickets: stats.garansiTickets
            });
          }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md hover:border-amber-300 transition-all cursor-pointer"
          title="Klik untuk melihat daftar unit klaim garansi"
        >
          <div className="absolute top-0 right-0 w-24 h-24 -mr-4 -mt-4 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
            <Award size={32} className="text-amber-300 transform -rotate-12 group-hover:text-amber-400 transition-all" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-amber-500 uppercase">UNIT KLAIM GARANSI</span>
            <div className="text-5xl font-black text-amber-500 tracking-tight mt-1">
              {stats.garansi}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1 text-amber-600 font-bold uppercase bg-amber-50 px-2 py-1 rounded-lg w-fit">
              Garansi Toko Aktif
            </div>
            <span className="text-amber-700 font-black text-[10px] flex items-center gap-1 group-hover:underline">
              Lihat Kartu <Eye size={12} />
            </span>
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
            <button
              onClick={() => {
                setModalSearchTerm("");
                setActiveTicketListModal({
                  title: "Daftar Unit Selesai (Tingkat Keberhasilan)",
                  subtitle: `Unit berhasil diselesaikan pada periode ${activePeriod.label}`,
                  badgeText: `${stats.berhasil} Unit`,
                  category: "success",
                  tickets: stats.berhasilTickets
                });
              }}
              className="w-full flex items-center justify-between text-xs font-bold bg-slate-50 hover:bg-emerald-50/70 p-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer group text-left"
              title="Klik untuk melihat daftar unit selesai"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
                <span className="text-slate-600 group-hover:text-emerald-800">Selesai (Selesai/Internal)</span>
              </div>
              <span className="font-black text-slate-900 group-hover:text-emerald-700 flex items-center gap-1">
                {stats.berhasil} Unit
                <Eye size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              </span>
            </button>

            <button
              onClick={() => {
                setModalSearchTerm("");
                setActiveTicketListModal({
                  title: "Daftar Unit Masalah (Kendala)",
                  subtitle: `Unit dengan catatan kendala follow up pada periode ${activePeriod.label}`,
                  badgeText: `${stats.bermasalah} Unit`,
                  category: "danger",
                  tickets: stats.bermasalahTickets
                });
              }}
              className="w-full flex items-center justify-between text-xs font-bold bg-slate-50 hover:bg-rose-50/70 p-2.5 rounded-xl border border-slate-100 hover:border-rose-200 transition-all cursor-pointer group text-left"
              title="Klik untuk melihat daftar unit bermasalah"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 group-hover:scale-125 transition-transform" />
                <span className="text-slate-600 group-hover:text-rose-800">Bermasalah (Kendala)</span>
              </div>
              <span className="font-black text-slate-900 group-hover:text-rose-700 flex items-center gap-1">
                {stats.bermasalah} Unit
                <Eye size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              </span>
            </button>
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
              <div 
                onClick={() => {
                  setModalSearchTerm("");
                  setActiveTicketListModal({
                    title: "Daftar Tiket: Telat Update Antrian (Admin)",
                    subtitle: `Unit dengan keterlambatan update pendaftaran antrian (> 15 menit) pada periode ${activePeriod.label}`,
                    badgeText: `${stats.adminTelatUpdateAntrian} Unit`,
                    category: "warning",
                    tickets: stats.adminTelatUpdateAntrianTickets
                  });
                }}
                className="p-3 rounded-2xl border border-transparent hover:border-amber-200 hover:bg-amber-50/40 transition-all cursor-pointer group"
                title="Klik untuk melihat detail kartu telat update antrian"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-black text-slate-700 group-hover:text-amber-800 uppercase tracking-tight flex items-center gap-1.5">
                    <span>Telat Update Antrian</span>
                    <Eye size={13} className="text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className={`px-2.5 py-1 text-xs font-black rounded-lg transition-transform group-hover:scale-105 ${
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-400 font-bold leading-normal">
                    SOP: Admin wajib memperbarui antrian dari parkir/pendaftaran maksimal 15 menit.
                  </p>
                  <span className="text-[10px] font-black text-amber-600 underline whitespace-nowrap ml-2">Lihat List</span>
                </div>
              </div>

              {/* Penalty 2: Telat Follow Up */}
              <div 
                onClick={() => {
                  setModalSearchTerm("");
                  setActiveTicketListModal({
                    title: "Daftar Tiket: Telat Follow Up (Admin)",
                    subtitle: `Unit dengan keterlambatan follow up kepuasan pelanggan (> 5 hari di follow up) pada periode ${activePeriod.label}`,
                    badgeText: `${stats.adminTelatFollowUp} Unit`,
                    category: "danger",
                    tickets: stats.adminTelatFollowUpTickets
                  });
                }}
                className="p-3 rounded-2xl border border-transparent hover:border-rose-200 hover:bg-rose-50/40 transition-all cursor-pointer group"
                title="Klik untuk melihat detail kartu telat follow up"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-black text-slate-700 group-hover:text-rose-800 uppercase tracking-tight flex items-center gap-1.5">
                    <span>Telat Follow Up</span>
                    <Eye size={13} className="text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className={`px-2.5 py-1 text-xs font-black rounded-lg transition-transform group-hover:scale-105 ${
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-400 font-bold leading-normal">
                    SOP: Admin wajib follow-up pelanggan maksimal 5 hari setelah tiket di kolom Follow Up.
                  </p>
                  <span className="text-[10px] font-black text-rose-600 underline whitespace-nowrap ml-2">Lihat List</span>
                </div>
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
                        <button
                          onClick={() => {
                            setModalSearchTerm("");
                            setActiveTicketListModal({
                              title: `Daftar Tiket Selesai - Mekanik ${m.name}`,
                              subtitle: `Unit yang diselesaikan oleh ${m.name} pada periode ${activePeriod.label}`,
                              badgeText: `${m.selesai} Unit`,
                              category: "info",
                              tickets: m.selesaiTickets
                            });
                          }}
                          className="text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                          title="Klik untuk melihat tiket selesai mekanik ini"
                        >
                          Selesai: <b>{m.selesai} Unit</b>
                        </button>
                        {m.garansi > 0 && (
                          <button
                            onClick={() => {
                              setModalSearchTerm("");
                              setActiveTicketListModal({
                                title: `Daftar Tiket Garansi - Mekanik ${m.name}`,
                                subtitle: `Unit garansi yang ditangani oleh ${m.name} pada periode ${activePeriod.label}`,
                                badgeText: `${m.garansi} Unit`,
                                category: "warning",
                                tickets: m.garansiTickets
                              });
                            }}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            title="Klik untuk melihat tiket garansi mekanik ini"
                          >
                            Garansi: <b>{m.garansi} Unit</b>
                          </button>
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
                    <button
                      onClick={() => {
                        setModalSearchTerm("");
                        setActiveTicketListModal({
                          title: `Daftar Tiket: Telat Update Service - Mekanik ${m.name}`,
                          subtitle: `Unit dengan keterlambatan update mulai service oleh ${m.name} pada periode ${activePeriod.label}`,
                          badgeText: `${m.telatUpdateService} Unit`,
                          category: "warning",
                          tickets: m.telatUpdateServiceTickets
                        });
                      }}
                      className="flex items-center justify-between gap-1 w-full sm:w-auto hover:bg-amber-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors group"
                      title="Klik untuk melihat tiket Telat Update Service"
                    >
                      <span className="text-slate-400 uppercase font-bold text-[9px] group-hover:text-amber-800">Telat Update:</span>
                      <span className={`font-black ${m.telatUpdateService > 0 ? "text-amber-600 underline" : "text-slate-600"}`}>
                        {m.telatUpdateService} Unit
                      </span>
                    </button>

                    <div className="hidden sm:block text-slate-300">|</div>

                    <button
                      onClick={() => {
                        setModalSearchTerm("");
                        setActiveTicketListModal({
                          title: `Daftar Tiket: Telat Selesai - Mekanik ${m.name}`,
                          subtitle: `Unit dengan keterlambatan update selesai/siap diambil oleh ${m.name} pada periode ${activePeriod.label}`,
                          badgeText: `${m.telatUpdateSelesai} Unit`,
                          category: "warning",
                          tickets: m.telatUpdateSelesaiTickets
                        });
                      }}
                      className="flex items-center justify-between gap-1 w-full sm:w-auto hover:bg-amber-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors group"
                      title="Klik untuk melihat tiket Telat Selesai"
                    >
                      <span className="text-slate-400 uppercase font-bold text-[9px] group-hover:text-amber-800">Telat Selesai:</span>
                      <span className={`font-black ${m.telatUpdateSelesai > 0 ? "text-amber-600 underline" : "text-slate-600"}`}>
                        {m.telatUpdateSelesai} Unit
                      </span>
                    </button>

                    <div className="hidden sm:block text-slate-300">|</div>

                    <button
                      onClick={() => {
                        setModalSearchTerm("");
                        setActiveTicketListModal({
                          title: `Daftar Tiket: Resi Hilang - Mekanik ${m.name}`,
                          subtitle: `Unit dengan status resi hilang pada tanggung jawab ${m.name} pada periode ${activePeriod.label}`,
                          badgeText: `${m.resiHilang} Unit`,
                          category: "danger",
                          tickets: m.resiHilangTickets
                        });
                      }}
                      className="flex items-center justify-between gap-1 w-full sm:w-auto hover:bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors group"
                      title="Klik untuk melihat tiket Resi Hilang"
                    >
                      <span className="text-slate-400 uppercase font-bold text-[9px] group-hover:text-rose-800">Resi Hilang:</span>
                      <span className={`font-black ${m.resiHilang > 0 ? "text-rose-600 underline" : "text-slate-600"}`}>
                        {m.resiHilang} Unit
                      </span>
                    </button>
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
      )}

      {/* TAB 2: PRODUKTIVITAS & JAM KERJA MEKANIK */}
      {activeTab === "mechanics" && (
        <div className="space-y-8 animate-fadeIn">
          {/* PERFORMA SERVICE MEKANIK SECTION */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Wrench size={20} className={themeColorClass} />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                    PERFORMA SERVICE MEKANIK
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  Analisis Kecepatan Pengerjaan Per Layanan (Jam Kerja Aktif 08:00 - 17:00) & Rekap Hasil Kendala
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-600">
                  <Clock size={14} className="text-slate-400" />
                  <span>Jam Kerja Aktif: <b>08:00 - 17:00</b></span>
                </div>

                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                  title={`Download Excel Detail Performa Mekanik (${activePeriod.label})`}
                >
                  <FileSpreadsheet size={15} />
                  <span>Download Excel</span>
                </button>
              </div>
            </div>

        <div className="grid grid-cols-1 gap-6">
          {mechanicServicePerformance.length > 0 ? (
            mechanicServicePerformance.map((m) => (
              <div key={m.id} className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 transition-all">
                {/* Mechanic Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${themeBgClass} text-white font-black text-lg flex items-center justify-center shadow-sm uppercase shrink-0`}>
                      {m.name.substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">
                        {m.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-bold text-slate-500">
                          Total Unit Ditangani: <b className="text-slate-800">{m.totalTickets} Unit</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stat Badges for Berhasil, Kendala, and Overall Speed */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-800">
                        Berhasil/Selesai: <b className="font-black text-emerald-950">{m.berhasilCount} Unit</b>
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (m.kendalaCount > 0) {
                          setModalSearchTerm("");
                          setActiveKendalaModal({
                            mechanicName: m.name,
                            tickets: m.kendalaTickets
                          });
                        }
                      }}
                      disabled={m.kendalaCount === 0}
                      className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 border text-left transition-all ${
                        m.kendalaCount > 0 
                          ? "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100 hover:border-rose-300 cursor-pointer shadow-2xs" 
                          : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed opacity-80"
                      }`}
                      title={m.kendalaCount > 0 ? "Klik untuk melihat daftar unit kendala" : "Tidak ada unit kendala"}
                    >
                      <AlertTriangle size={14} className={m.kendalaCount > 0 ? "text-rose-600" : "text-slate-400"} />
                      <span className="text-xs font-bold">
                        Kendala: <b className="font-black">{m.kendalaCount} Unit</b>
                        {m.kendalaCount > 0 && <span className="text-[10px] ml-1 text-rose-600 font-semibold underline">(Lihat List)</span>}
                      </span>
                    </button>

                    <div className="bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5" title="Total akumulasi Active Timer semua kartu di periode ini">
                      <Zap size={14} className="text-amber-600" />
                      <span className="text-xs font-bold text-amber-900">
                        Jam Kerja Efektif: <b className="font-mono font-black text-amber-950">{m.jamKerjaEfektifStr}</b>
                      </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5" title="Rata-rata kecepatan per unit (Active Timer + Pause Timer)">
                      <Clock size={14} className="text-blue-600" />
                      <span className="text-xs font-bold text-blue-800">
                        Rata-rata Speed Total: <b className="font-mono font-black text-blue-950">{m.overallSpeedStr}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Layanan Speed Cards */}
                <div className="mt-4">
                  <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Wrench size={13} className="text-slate-400" /> KECEPATAN PENGERJAAN PER LAYANAN (ACTIVE + PAUSE TIMER)
                  </h5>

                  {m.services.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {m.services.map((svc, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setModalSearchTerm("");
                            setActiveServiceModal({
                              mechanicName: m.name,
                              serviceName: svc.serviceName,
                              avgSpeedStr: svc.speedStr,
                              ticketItems: svc.ticketItems
                            });
                          }}
                          className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 hover:border-blue-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all text-left cursor-pointer group"
                          title="Klik untuk melihat detail list unit"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-slate-800 truncate uppercase group-hover:text-blue-600 flex items-center gap-1.5 transition-colors">
                              <span>{svc.serviceName}</span>
                              <Eye size={12} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                              {svc.count} Unit Dikerjakan <span className="text-blue-600 font-normal ml-0.5">(Lihat Detail)</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[9px] font-bold uppercase text-slate-400 mb-0.5 tracking-wider">Rata-Rata Speed</span>
                            <div className="bg-slate-900 text-emerald-400 px-2.5 py-1 rounded-lg font-mono text-xs font-black tracking-tight whitespace-nowrap shadow-xs group-hover:bg-blue-950 group-hover:text-emerald-300 transition-colors">
                              {svc.speedStr}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs font-bold text-slate-400 bg-white rounded-xl border border-slate-200/60">
                      Belum ada pengerjaan dengan timestamp Siap & Datang pada periode ini
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold uppercase bg-slate-50 rounded-2xl border border-slate-200">
              Tidak ada data pengerjaan mekanik pada periode {activePeriod.label}
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {/* TAB 3: REKONSILIASI & REKAP BULANAN WHATSAPP */}
      {activeTab === "reconciliation" && (
        <MonthlyReconciliationTab
          tickets={tickets}
          mechanics={mechanics}
          currentBranch={currentBranch}
          activePeriod={activePeriod}
          isMK={isMK}
          themeColorClass={themeColorClass}
          themeBgClass={themeBgClass}
          themeBorderClass={themeBorderClass}
          onOpenTicketListModal={setActiveTicketListModal}
          onBackToOperational={() => setActiveTab("operational")}
        />
      )}

      {/* SERVICE DETAIL POP-UP MODAL */}
      {activeServiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Wrench size={20} className="text-emerald-400" />
                  <h3 className="text-lg font-black uppercase tracking-tight">
                    Daftar Unit Service: {activeServiceModal.serviceName}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-300">
                  <span className="font-bold">Mekanik: <b className="text-white">{activeServiceModal.mechanicName}</b></span>
                  <span>•</span>
                  <span className="font-bold">Total Pengerjaan: <b className="text-white">{activeServiceModal.ticketItems.length} Unit</b></span>
                  <span>•</span>
                  <div className="bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-2.5 py-0.5 rounded-md font-mono font-bold text-xs">
                    Rata-Rata Speed: {activeServiceModal.avgSpeedStr} / unit
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveServiceModal(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter / Search Bar inside Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama pelanggan, telepon, atau sepeda..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-semibold hidden sm:block">
                *Durasi dihitung jam kerja aktif (08:00 - 17:00)
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Pelanggan & Kontak</th>
                    <th className="py-3 px-3">Sepeda / Unit</th>
                    <th className="py-3 px-3">Jam Mulai</th>
                    <th className="py-3 px-3">Jam Siap</th>
                    <th className="py-3 px-3 text-center">Active Timer</th>
                    <th className="py-3 px-3 text-center">Pause Timer</th>
                    <th className="py-3 px-3 text-right">Durasi Pengerjaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {activeServiceModal.ticketItems
                    .filter(item => {
                      if (!modalSearchTerm.trim()) return true;
                      const query = modalSearchTerm.toLowerCase();
                      const cust = (item.ticket.customerName || "").toLowerCase();
                      const bike = (item.ticket.unitSepeda || "").toLowerCase();
                      const phone = (item.ticket.phone || "").toLowerCase();
                      return cust.includes(query) || bike.includes(query) || phone.includes(query);
                    })
                    .map((item, idx) => {
                      const formatDT = (dtStr?: string) => {
                        if (!dtStr) return "-";
                        const d = new Date(dtStr);
                        if (isNaN(d.getTime())) return "-";
                        return d.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                      };

                      return (
                        <tr key={item.ticket.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.ticket.customerName || "Pelanggan N/A"}</div>
                            <div className="font-mono text-[11px] text-slate-500 font-bold">{item.ticket.phone || "-"}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">
                              {item.ticket.unitSepeda || "Sepeda N/A"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                            {formatDT(item.mulaiStr)}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                            {formatDT(item.readyStr)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border border-emerald-200/80">
                              {item.activeTimerStr}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border border-amber-200/80">
                              {item.pauseTimerStr}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border border-slate-200">
                              {item.activeDurationStr}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {activeServiceModal.ticketItems.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  Tidak ada unit untuk layanan ini.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-semibold">
                Menampilkan <b className="text-slate-800">{activeServiceModal.ticketItems.length}</b> unit pengerjaan
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-xl font-bold">
                <span>Rata-Rata Kecepatan (Siap - Mulai):</span>
                <span className="font-mono text-emerald-700 font-black text-sm">{activeServiceModal.avgSpeedStr}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KENDALA DETAIL POP-UP MODAL */}
      {activeKendalaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-rose-950 text-white flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-rose-400" />
                  <h3 className="text-lg font-black uppercase tracking-tight">
                    Daftar Unit Kendala
                  </h3>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-rose-200">
                  <span className="font-bold">Mekanik: <b className="text-white">{activeKendalaModal.mechanicName}</b></span>
                  <span>•</span>
                  <span className="font-bold">Total Kendala: <b className="text-white">{activeKendalaModal.tickets.length} Unit</b></span>
                </div>
              </div>

              <button
                onClick={() => setActiveKendalaModal(null)}
                className="p-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-rose-200 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama pelanggan, unit sepeda, atau catatan kendala..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Pelanggan & Kontak</th>
                    <th className="py-3 px-3">Sepeda / Unit</th>
                    <th className="py-3 px-3">Layanan</th>
                    <th className="py-3 px-3">Hasil / Catatan Kendala</th>
                    <th className="py-3 px-3 text-right">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {activeKendalaModal.tickets
                    .filter(t => {
                      if (!modalSearchTerm.trim()) return true;
                      const query = modalSearchTerm.toLowerCase();
                      const cust = (t.customerName || "").toLowerCase();
                      const bike = (t.unitSepeda || "").toLowerCase();
                      const notes = `${t.notes || ''} ${t.followUpResult || ''}`.toLowerCase();
                      return cust.includes(query) || bike.includes(query) || notes.includes(query);
                    })
                    .map((t, idx) => {
                      const formatDT = (dtStr?: string) => {
                        if (!dtStr) return "-";
                        const d = new Date(dtStr);
                        if (isNaN(d.getTime())) return "-";
                        return d.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                      };

                      const dateStr = t.timestamps?.finished || t.timestamps?.ready || t.timestamps?.arrival;

                      return (
                        <tr key={t.id || idx} className="hover:bg-rose-50/30 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{t.customerName || "Pelanggan N/A"}</div>
                            <div className="font-mono text-[11px] text-slate-500 font-bold">{t.phone || "-"}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">
                              {t.unitSepeda || "Sepeda N/A"}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-600">
                            {t.serviceTypes?.join(", ") || "Servis Umum"}
                          </td>
                          <td className="py-3 px-3">
                            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-2 rounded-xl text-xs font-bold flex flex-col gap-1">
                              <div>{t.followUpResult || "KENDALA"}</div>
                              {t.notes && <div className="text-[11px] text-rose-700 font-normal italic">{t.notes}</div>}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 font-medium whitespace-nowrap">
                            {formatDT(dateStr)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {activeKendalaModal.tickets.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  Tidak ada unit kendala ditemukan.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Total Unit Kendala: <b className="text-rose-700">{activeKendalaModal.tickets.length} Unit</b></span>
              <button
                onClick={() => setActiveKendalaModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERIC TICKET LIST POP-UP MODAL (OPERASIONAL & KEDISIPLINAN SOP) */}
      {activeTicketListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className={`p-6 text-white flex items-start justify-between gap-4 ${
              activeTicketListModal.category === "danger" 
                ? "bg-rose-950" 
                : activeTicketListModal.category === "warning"
                  ? "bg-amber-950"
                  : activeTicketListModal.category === "success"
                    ? "bg-emerald-950"
                    : activeTicketListModal.category === "primary"
                      ? "bg-indigo-950"
                      : "bg-slate-900"
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  {activeTicketListModal.category === "danger" && <AlertTriangle size={20} className="text-rose-400" />}
                  {activeTicketListModal.category === "warning" && <Award size={20} className="text-amber-400" />}
                  {activeTicketListModal.category === "success" && <CheckCircle2 size={20} className="text-emerald-400" />}
                  {activeTicketListModal.category === "info" && <FileBarChart2 size={20} className="text-indigo-400" />}
                  {activeTicketListModal.category === "primary" && <Shield size={20} className="text-indigo-400" />}
                  <h3 className="text-lg font-black uppercase tracking-tight">
                    {activeTicketListModal.title}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs opacity-90">
                  {activeTicketListModal.badgeText && (
                    <span className="font-bold bg-white/15 px-2.5 py-0.5 rounded-md border border-white/20">
                      Total: <b className="text-white">{activeTicketListModal.badgeText}</b>
                    </span>
                  )}
                  <span>•</span>
                  <span className="font-medium text-slate-300">
                    Periode: <b className="text-white">{activePeriod.label}</b>
                  </span>
                  {activeTicketListModal.subtitle && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-[11px] text-slate-300 w-full sm:w-auto">
                        {activeTicketListModal.subtitle}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => setActiveTicketListModal(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari pelanggan, no tiket, sepeda, mekanik, catatan..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-bold flex items-center justify-between sm:justify-end gap-2">
                <span>
                  Menampilkan <b>{filteredModalTickets.length}</b> dari {activeTicketListModal.tickets.length} Unit
                </span>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Pelanggan & Kontak</th>
                      <th className="py-3 px-3">Sepeda / Unit</th>
                      <th className="py-3 px-3">Layanan</th>
                      <th className="py-3 px-3">Mekanik PIC</th>
                      <th className="py-3 px-3">Hasil / Catatan</th>
                      <th className="py-3 px-3">Pelanggaran SOP</th>
                      <th className="py-3 px-3 text-right">Tanggal Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {filteredModalTickets.map((t, idx) => {
                      const formatDT = (dtStr?: string) => {
                        if (!dtStr) return "-";
                        const d = new Date(dtStr);
                        if (isNaN(d.getTime())) return "-";
                        return d.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                      };

                      const dateStr = t.timestamps?.finished || t.timestamps?.ready || t.timestamps?.arrival;
                      const finalMech = (t.overtimeMechanic && t.overtimeMechanic.trim()) 
                        ? t.overtimeMechanic.trim() 
                        : (t.mechanic ? t.mechanic.trim() : "-");

                      const isGaransi = isGaransiTicket(t);
                      const isKendala = isBermasalahTicket(t);
                      const isBerhasil = isBerhasilTicket(t);

                      // Extract violation flags
                      const penaltyBadges: { label: string; color: string }[] = [];
                      if (t.flags?.some(f => (f as any) === "TELAT_UPDATE_ANTRIAN" || (f as any) === "TELAT_UPDATE")) {
                        penaltyBadges.push({ label: "Telat Antrian", color: "bg-amber-100 text-amber-800 border-amber-200" });
                      }
                      if (t.flags?.some(f => (f as any) === "TELAT_FOLLOW_UP" || (f as any) === "LATE_FOLLOW_UP")) {
                        penaltyBadges.push({ label: "Telat Follow Up", color: "bg-rose-100 text-rose-800 border-rose-200" });
                      }
                      if (t.flags?.includes("TELAT_UPDATE_SERVICE" as any)) {
                        penaltyBadges.push({ label: "Telat Service", color: "bg-amber-100 text-amber-800 border-amber-200" });
                      }
                      if (t.flags?.some(f => (f as any) === "TELAT_UPDATE_SELESAI" || (f as any) === "TELAT_SELESAI")) {
                        penaltyBadges.push({ label: "Telat Selesai", color: "bg-amber-100 text-amber-800 border-amber-200" });
                      }
                      if (t.flags?.includes("RESI_HILANG" as any)) {
                        penaltyBadges.push({ label: "Resi Hilang", color: "bg-rose-100 text-rose-800 border-rose-200" });
                      }

                      return (
                        <tr key={t.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {t.ticketNumber && (
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1 rounded">
                                  #{t.ticketNumber}
                                </span>
                              )}
                              <div className="font-bold text-slate-900">{t.customerName || "Pelanggan N/A"}</div>
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 font-bold">{t.phone || "-"}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">
                              {t.unitSepeda || "Sepeda N/A"}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-600 max-w-[160px]">
                            <div className="truncate" title={t.serviceTypes?.join(", ")}>
                              {t.serviceTypes?.join(", ") || "Servis Umum"}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <span>{finalMech}</span>
                              {t.overtimeMechanic && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1 rounded">Lembur</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              {isGaransi ? (
                                <span className="w-fit text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                  GARANSI
                                </span>
                              ) : isKendala ? (
                                <span className="w-fit text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded">
                                  KENDALA
                                </span>
                              ) : isBerhasil ? (
                                <span className="w-fit text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                                  {t.followUpResult || "SELESAI"}
                                </span>
                              ) : (
                                <span className="w-fit text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                  {t.followUpResult || "-"}
                                </span>
                              )}
                              {t.notes && (
                                <div className="text-[11px] text-slate-500 italic max-w-xs truncate" title={t.notes}>
                                  {t.notes}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {penaltyBadges.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {penaltyBadges.map((badge, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badge.color}`}
                                  >
                                    {badge.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                                <Check size={12} /> Tertib SOP
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 font-medium whitespace-nowrap">
                            {formatDT(dateStr)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredModalTickets.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                  Tidak ada kartu / unit yang cocok dengan pencarian.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>
                Total: <b className="text-slate-800 font-black">{filteredModalTickets.length} Unit</b>
              </span>
              <button
                onClick={() => setActiveTicketListModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;
