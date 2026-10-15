import React, { useState, useMemo, useEffect } from "react";
import {
  Ticket,
  MechanicDefinition,
  Branch,
  flag_type,
} from "../types";
import { reconcileTicketInCloud } from "../services/ticketService";
import {
  FileCheck2,
  Copy,
  Check,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Clock,
  Filter,
  Search,
  UserCheck,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Send,
  X,
  Info,
  CheckCircle2,
  Wrench,
  ThumbsUp,
  HelpCircle,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  RotateCcw,
  Shield,
  Award
} from "lucide-react";

export interface Period {
  type: "monthly" | "yearly";
  label: string;
  subtext: string;
  startDate: Date;
  endDate: Date;
}

export interface ProblemFlagInfo {
  code: string;
  label: string;
  category: "admin" | "mechanic" | "followup" | "warranty";
  colorClass: string;
  badgeBg: string;
  iconName: string;
}

export interface ReconciledTicketItem {
  ticket: Ticket;
  problems: ProblemFlagInfo[];
  mechanicName: string;
  isWrittenOff: boolean;
  writeOffReason?: string;
  writtenOffAt?: string;
  writtenOffBy?: string;
}

interface MonthlyReconciliationTabProps {
  tickets: Ticket[];
  mechanics: MechanicDefinition[];
  currentBranch: Branch;
  activePeriod: Period;
  isMK: boolean;
  themeColorClass: string;
  themeBgClass: string;
  themeBorderClass: string;
  onOpenTicketListModal?: (modalConfig: {
    title: string;
    subtitle?: string;
    badgeText?: string;
    category: "success" | "danger" | "warning" | "info" | "primary";
    tickets: Ticket[];
  }) => void;
  onBackToOperational?: () => void;
}

const PIN_STORAGE_KEY = "dailybike_reconciliation_security_pin";
const DEFAULT_PIN = "7788";

const getStoredSecurityPin = (): string => {
  try {
    const saved = localStorage.getItem(PIN_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    // If not set yet, store default 7788
    localStorage.setItem(PIN_STORAGE_KEY, DEFAULT_PIN);
    return DEFAULT_PIN;
  } catch (e) {
    return DEFAULT_PIN;
  }
};

export const MonthlyReconciliationTab: React.FC<MonthlyReconciliationTabProps> = ({
  tickets,
  mechanics,
  currentBranch,
  activePeriod,
  isMK,
  themeColorClass,
  themeBgClass,
  themeBorderClass,
  onOpenTicketListModal,
  onBackToOperational,
}) => {
  const branchLabel = isMK ? "Muara Karang" : "PIK 2";

  // --- PIN SECURITY STATE ---
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [showPinText, setShowPinText] = useState<boolean>(false);

  // Change PIN Modal State
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [oldPin, setOldPin] = useState<string>("");
  const [newPin, setNewPin] = useState<string>("");
  const [confirmNewPin, setConfirmNewPin] = useState<string>("");
  const [changePinError, setChangePinError] = useState<string>("");
  const [changePinSuccess, setChangePinSuccess] = useState<string>("");
  const [showOldPin, setShowOldPin] = useState<boolean>(false);
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [showConfirmPin, setShowConfirmPin] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string>("");

  // Local write-off overrides cache (persisted in localStorage as safety fallback)
  const localCacheKey = `db_reconciled_overrides_${currentBranch}`;
  const [localOverrides, setLocalOverrides] = useState<Record<string, {
    isWrittenOff: boolean;
    reason: string;
    at: string;
    by: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem(localCacheKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Active modal for writing off or editing reasons
  const [modalTicket, setModalTicket] = useState<ReconciledTicketItem | null>(null);
  const [reasonInput, setReasonInput] = useState<string>("");
  const [reviewerInput, setReviewerInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal for confirming cancellation of write-off
  const [confirmCancelTicketId, setConfirmCancelTicketId] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "written_off">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "admin" | "mechanic" | "warranty">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // WhatsApp Options & Copy Feedback
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [includeWrittenOffList, setIncludeWrittenOffList] = useState<boolean>(true);
  const [includeMechanicSummary, setIncludeMechanicSummary] = useState<boolean>(true);
  const [includeAdminSummary, setIncludeAdminSummary] = useState<boolean>(true);
  const [customNotes, setCustomNotes] = useState<string>("");

  // --- PIN VERIFICATION HANDLER ---
  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stored = getStoredSecurityPin();
    if (pinInput.trim() === stored) {
      setIsUnlocked(true);
      setPinError("");
      setPinInput("");
    } else {
      setPinError("PIN yang Anda masukkan salah. Silakan coba lagi.");
    }
  };

  // --- CHANGE PIN HANDLER ---
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError("");
    setChangePinSuccess("");

    const currentPin = getStoredSecurityPin();
    if (oldPin.trim() !== currentPin) {
      setChangePinError("PIN Lama yang dimasukkan tidak sesuai.");
      return;
    }

    if (newPin.trim().length < 4) {
      setChangePinError("PIN Baru minimal 4 karakter / angka.");
      return;
    }

    if (newPin.trim() !== confirmNewPin.trim()) {
      setChangePinError("Konfirmasi PIN Baru tidak cocok dengan PIN Baru.");
      return;
    }

    try {
      localStorage.setItem(PIN_STORAGE_KEY, newPin.trim());
      setChangePinSuccess("PIN Keamanan Rekonsiliasi berhasil diubah!");
      setTimeout(() => {
        setShowChangePinModal(false);
        setOldPin("");
        setNewPin("");
        setConfirmNewPin("");
        setChangePinError("");
        setChangePinSuccess("");
        setToastMessage("PIN keamanan rekonsiliasi berhasil diperbarui!");
        setTimeout(() => setToastMessage(""), 3500);
      }, 1000);
    } catch (err) {
      setChangePinError("Gagal menyimpan PIN baru ke penyimpanan lokal.");
    }
  };

  // Helper: check if ticket is warranty
  const isGaransiTicket = (t: Ticket) => {
    const hasGaransiNote = t.notes && t.notes.includes("[GARANSI]");
    const hasGaransiService = t.serviceTypes && t.serviceTypes.some(s => s.trim().toUpperCase() === "GARANSI");
    return !!(hasGaransiNote || hasGaransiService);
  };

  // Helper: get the single last assigned mechanic
  const getFinalMechanic = (t: Ticket): string => {
    const mech = (t.overtimeMechanic && t.overtimeMechanic.trim())
      ? t.overtimeMechanic.trim()
      : (t.mechanic ? t.mechanic.trim() : "");
    return mech.toUpperCase();
  };

  // Filter completed tickets in current period
  const completedTicketsInPeriod = useMemo(() => {
    const start = activePeriod.startDate;
    const end = activePeriod.endDate;

    return tickets.filter(t => {
      if (t.branch !== currentBranch) return false;
      if (t.status === "cancelled") return false;
      if (t.status !== "done") return false;
      if (!t.followUpResult || t.followUpResult.trim() === "") return false;
      
      const tFinished = t.timestamps?.finished ? new Date(t.timestamps.finished) : null;
      if (!tFinished) return false;
      return tFinished >= start && tFinished <= end;
    });
  }, [tickets, currentBranch, activePeriod]);

  // Extract all tickets that have ANY problem or SOP infraction
  // Correctly segregated:
  // Admin: Telat Update Antrian, Telat Follow Up (Kendala follow up customer TIDAK dimasukkan)
  // Mechanic: Telat Update Service, Telat Selesai (termasuk Telat Update Selesai), Resi Hilang
  // Warranty: Klaim Garansi
  const problemItems = useMemo<ReconciledTicketItem[]>(() => {
    const items: ReconciledTicketItem[] = [];

    completedTicketsInPeriod.forEach(t => {
      const flagsDetected: ProblemFlagInfo[] = [];

      // 1. Unit Klaim Garansi
      if (isGaransiTicket(t)) {
        flagsDetected.push({
          code: "KLAIM_GARANSI",
          label: "Unit Klaim Garansi",
          category: "warranty",
          colorClass: "text-purple-600 bg-purple-50 border-purple-200",
          badgeBg: "bg-purple-100 text-purple-800",
          iconName: "shield-alert"
        });
      }

      // 2. Admin: Telat Update Antrian
      if (t.flags?.some(f => (f as any) === "TELAT_UPDATE_ANTRIAN" || (f as any) === "TELAT_UPDATE")) {
        flagsDetected.push({
          code: "TELAT_UPDATE_ANTRIAN",
          label: "Telat Update Antrian (Admin)",
          category: "admin",
          colorClass: "text-amber-600 bg-amber-50 border-amber-200",
          badgeBg: "bg-amber-100 text-amber-800",
          iconName: "clock"
        });
      }

      // 3. Admin: Telat Follow Up
      if (t.flags?.some(f => (f as any) === "TELAT_FOLLOW_UP" || (f as any) === "LATE_FOLLOW_UP")) {
        flagsDetected.push({
          code: "TELAT_FOLLOW_UP",
          label: "Telat Follow Up (Admin)",
          category: "admin",
          colorClass: "text-orange-600 bg-orange-50 border-orange-200",
          badgeBg: "bg-orange-100 text-orange-800",
          iconName: "clock"
        });
      }

      // 4. Mekanik: Telat Update Mulai Service
      if (t.flags?.includes("TELAT_UPDATE_SERVICE" as any)) {
        flagsDetected.push({
          code: "TELAT_UPDATE_SERVICE",
          label: "Telat Mulai Service (Mekanik)",
          category: "mechanic",
          colorClass: "text-amber-600 bg-amber-50 border-amber-200",
          badgeBg: "bg-amber-100 text-amber-800",
          iconName: "clock"
        });
      }

      // 5. Mekanik: Telat Selesai / Telat Update Siap Pengerjaan
      if (t.flags?.some(f => (f as any) === "TELAT_SELESAI" || (f as any) === "TELAT_UPDATE_SELESAI")) {
        flagsDetected.push({
          code: "TELAT_SELESAI",
          label: "Telat Selesai Pengerjaan (Mekanik)",
          category: "mechanic",
          colorClass: "text-orange-600 bg-orange-50 border-orange-200",
          badgeBg: "bg-orange-100 text-orange-800",
          iconName: "clock"
        });
      }

      // 6. Mekanik: Resi Hilang
      if (t.flags?.includes("RESI_HILANG" as any)) {
        flagsDetected.push({
          code: "RESI_HILANG",
          label: "Resi Hilang / Fisik Hilang (Mekanik)",
          category: "mechanic",
          colorClass: "text-red-700 bg-red-50 border-red-200",
          badgeBg: "bg-red-100 text-red-800",
          iconName: "alert-triangle"
        });
      }

      // If any problem exists on this ticket:
      if (flagsDetected.length > 0) {
        // Resolve write-off status: check local cache first, fallback to ticket prop
        const localOverride = localOverrides[t.id];
        const isWrittenOff = (localOverride !== undefined && localOverride.isWrittenOff !== undefined)
          ? localOverride.isWrittenOff
          : Boolean(t.isWrittenOff);
        
        const writeOffReason = (localOverride !== undefined && localOverride.isWrittenOff !== undefined)
          ? (localOverride.isWrittenOff ? localOverride.reason : "")
          : (t.writeOffReason || "");

        const writtenOffAt = (localOverride !== undefined && localOverride.isWrittenOff !== undefined)
          ? (localOverride.isWrittenOff ? localOverride.at : "")
          : (t.writtenOffAt || "");

        const writtenOffBy = (localOverride !== undefined && localOverride.isWrittenOff !== undefined)
          ? (localOverride.isWrittenOff ? localOverride.by : "")
          : (t.writtenOffBy || "");

        // Determine mechanic name
        const assignedUpper = getFinalMechanic(t);
        const mechObj = mechanics.find(m => m.name.trim().toUpperCase() === assignedUpper || m.id.toUpperCase() === assignedUpper);
        const mechanicName = mechObj ? mechObj.name : (t.overtimeMechanic || t.mechanic || "Belum Ditugaskan");

        items.push({
          ticket: t,
          problems: flagsDetected,
          mechanicName,
          isWrittenOff,
          writeOffReason,
          writtenOffAt,
          writtenOffBy
        });
      }
    });

    return items;
  }, [completedTicketsInPeriod, localOverrides, mechanics]);

  // Overall statistics (Gross vs Reconciled vs Net)
  const stats = useMemo(() => {
    const totalSelesaiNonGaransi = completedTicketsInPeriod.filter(t => !isGaransiTicket(t)).length;
    const totalGaransi = completedTicketsInPeriod.filter(t => isGaransiTicket(t)).length;
    const totalCards = completedTicketsInPeriod.length;

    // Berhasil tickets
    const grossBerhasilCount = completedTicketsInPeriod.filter(t => {
      if (isGaransiTicket(t)) return false;
      const res = t.followUpResult?.trim();
      return res === "Selesai" || res === "Berhasil" || res === "Tidak Respond" || res === "Milik Internal";
    }).length;

    // Total gross problems (distinct tickets with issues)
    const grossProblemsCount = problemItems.length;

    // Written-off tickets count
    const writtenOffItems = problemItems.filter(p => p.isWrittenOff);
    const writtenOffCount = writtenOffItems.length;

    // Net active problems (unresolved / without justified reason)
    const netProblemsCount = Math.max(0, grossProblemsCount - writtenOffCount);

    // Success rate (non-garansi)
    const grossSuccessRate = totalSelesaiNonGaransi > 0 ? Math.round((grossBerhasilCount / totalSelesaiNonGaransi) * 100) : 0;
    const netSuccessRate = grossSuccessRate;

    // Admin penalties (Gross vs Net) - Telat Update Antrian & Telat Follow-Up
    const grossAdminTelatAntrian = problemItems.filter(p => p.problems.some(f => f.code === "TELAT_UPDATE_ANTRIAN")).length;
    const dispensasiAdminTelatAntrian = writtenOffItems.filter(p => p.problems.some(f => f.code === "TELAT_UPDATE_ANTRIAN")).length;
    const netAdminTelatAntrian = Math.max(0, grossAdminTelatAntrian - dispensasiAdminTelatAntrian);

    const grossAdminTelatFollowUp = problemItems.filter(p => p.problems.some(f => f.code === "TELAT_FOLLOW_UP")).length;
    const dispensasiAdminTelatFollowUp = writtenOffItems.filter(p => p.problems.some(f => f.code === "TELAT_FOLLOW_UP")).length;
    const netAdminTelatFollowUp = Math.max(0, grossAdminTelatFollowUp - dispensasiAdminTelatFollowUp);

    const grossAdminPenalties = grossAdminTelatAntrian + grossAdminTelatFollowUp;
    const netAdminPenalties = netAdminTelatAntrian + netAdminTelatFollowUp;
    const totalAdminDispensasi = dispensasiAdminTelatAntrian + dispensasiAdminTelatFollowUp;

    // Admin Compliance Score (Skor Kepatuhan Admin)
    const grossAdminComplianceScore = totalCards > 0
      ? Math.max(0, 100 - Math.round((grossAdminPenalties / totalCards) * 100))
      : (grossAdminPenalties > 0 ? 0 : 100);

    const netAdminComplianceScore = totalCards > 0
      ? Math.max(0, 100 - Math.round((netAdminPenalties / totalCards) * 100))
      : (netAdminPenalties > 0 ? 0 : 100);

    // Total mechanic issues written off
    const totalMechanicDispensasi = writtenOffItems.filter(p => p.problems.some(f => f.category === "mechanic")).length;

    // Mechanic performance net
    // Tanggung Jawab Mekanik: TELAT_UPDATE_SERVICE, TELAT_SELESAI, RESI_HILANG.
    const mechanicBreakdown = mechanics.map(m => {
      const nameUpper = m.name.trim().toUpperCase();
      const picTickets = completedTicketsInPeriod.filter(t => {
        const assignedUpper = getFinalMechanic(t);
        return assignedUpper === nameUpper || assignedUpper === m.id.toUpperCase();
      });

      const selesaiPic = picTickets.filter(t => !isGaransiTicket(t)).length;
      const garansiPic = picTickets.filter(t => isGaransiTicket(t)).length;
      const totalUnits = selesaiPic + garansiPic;

      // Filter problem items for this mechanic
      const mechProblems = problemItems.filter(p => {
        const assignedUpper = getFinalMechanic(p.ticket);
        return assignedUpper === nameUpper || assignedUpper === m.id.toUpperCase();
      });

      // Gross penalties (Strictly Mechanic Responsibilities)
      const grossTelatService = mechProblems.filter(p => p.problems.some(f => f.code === "TELAT_UPDATE_SERVICE")).length;
      const grossTelatSelesai = mechProblems.filter(p => p.problems.some(f => f.code === "TELAT_SELESAI")).length;
      const grossResiHilang = mechProblems.filter(p => p.problems.some(f => f.code === "RESI_HILANG")).length;
      const grossPenalties = grossTelatService + grossTelatSelesai + grossResiHilang;

      // Net penalties (only unresolved/non-written-off mechanic infractions)
      const netTelatService = mechProblems.filter(p => !p.isWrittenOff && p.problems.some(f => f.code === "TELAT_UPDATE_SERVICE")).length;
      const netTelatSelesai = mechProblems.filter(p => !p.isWrittenOff && p.problems.some(f => f.code === "TELAT_SELESAI")).length;
      const netResiHilang = mechProblems.filter(p => !p.isWrittenOff && p.problems.some(f => f.code === "RESI_HILANG")).length;
      const netPenalties = netTelatService + netTelatSelesai + netResiHilang;

      // Dispensasi Diterima for Mechanic:
      // ONLY count written-off tickets that had actual MECHANIC infractions!
      const writtenOffForMech = mechProblems.filter(p =>
        p.isWrittenOff && p.problems.some(f => f.category === "mechanic")
      ).length;

      const netComplianceScore = totalUnits > 0
        ? Math.max(0, 100 - Math.round((netPenalties / totalUnits) * 100))
        : (netPenalties > 0 ? 0 : 100);

      const grossComplianceScore = totalUnits > 0
        ? Math.max(0, 100 - Math.round((grossPenalties / totalUnits) * 100))
        : (grossPenalties > 0 ? 0 : 100);

      return {
        id: m.id,
        name: m.name,
        selesai: selesaiPic,
        garansi: garansiPic,
        totalUnits,
        grossPenalties,
        netPenalties,
        writtenOffCount: writtenOffForMech,
        netTelatService,
        netTelatSelesai,
        netResiHilang,
        grossComplianceScore,
        netComplianceScore
      };
    });

    return {
      totalCards,
      totalSelesaiNonGaransi,
      totalGaransi,
      grossProblemsCount,
      writtenOffCount,
      netProblemsCount,
      grossSuccessRate,
      netSuccessRate,
      grossAdminTelatAntrian,
      dispensasiAdminTelatAntrian,
      netAdminTelatAntrian,
      grossAdminTelatFollowUp,
      dispensasiAdminTelatFollowUp,
      netAdminTelatFollowUp,
      grossAdminPenalties,
      netAdminPenalties,
      grossAdminComplianceScore,
      netAdminComplianceScore,
      totalAdminDispensasi,
      totalMechanicDispensasi,
      mechanicBreakdown,
      writtenOffItems
    };
  }, [completedTicketsInPeriod, problemItems, mechanics]);

  // Filtered problem items for display
  const filteredProblemItems = useMemo(() => {
    return problemItems.filter(item => {
      // Status filter
      if (statusFilter === "pending" && item.isWrittenOff) return false;
      if (statusFilter === "written_off" && !item.isWrittenOff) return false;

      // Category filter
      if (categoryFilter !== "all") {
        const hasCategory = item.problems.some(p => p.category === categoryFilter);
        if (!hasCategory) return false;
      }

      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const t = item.ticket;
        const matchTicket = (t.ticketNumber || "").toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
        const matchCustomer = (t.customerName || "").toLowerCase().includes(q) || (t.phone || "").includes(q);
        const matchBike = (t.unitSepeda || "").toLowerCase().includes(q);
        const matchMech = (item.mechanicName || "").toLowerCase().includes(q);
        const matchReason = (item.writeOffReason || "").toLowerCase().includes(q);
        const matchFlags = item.problems.some(p => p.label.toLowerCase().includes(q));

        if (!matchTicket && !matchCustomer && !matchBike && !matchMech && !matchReason && !matchFlags) {
          return false;
        }
      }

      return true;
    });
  }, [problemItems, statusFilter, categoryFilter, searchQuery]);

  // Open modal to write off ticket
  const handleOpenWriteOffModal = (item: ReconciledTicketItem) => {
    setModalTicket(item);
    setReasonInput(item.writeOffReason || "");
    // User requirement: no pre-filled, just dropdown (Supervisor or Owner)
    setReviewerInput(item.writtenOffBy || "");
  };

  // Submit write-off action
  const handleSaveWriteOff = async () => {
    if (!modalTicket) return;
    const cleanReason = reasonInput.trim();
    if (!cleanReason) {
      alert("Mohon masukkan alasan justifikasi write-off terlebih dahulu.");
      return;
    }
    if (!reviewerInput) {
      alert("Mohon pilih validator (Supervisor atau Owner).");
      return;
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();
    const reviewer = reviewerInput;

    // 1. Update local cache
    const newOverrides = {
      ...localOverrides,
      [modalTicket.ticket.id]: {
        isWrittenOff: true,
        reason: cleanReason,
        at: nowIso,
        by: reviewer
      }
    };
    setLocalOverrides(newOverrides);
    try {
      localStorage.setItem(localCacheKey, JSON.stringify(newOverrides));
    } catch (e) {}

    // 2. Direct memory update on ticket object so UI and stats update instantly
    const targetTicket = tickets.find(t => t.id === modalTicket.ticket.id);
    if (targetTicket) {
      targetTicket.isWrittenOff = true;
      targetTicket.writeOffReason = cleanReason;
      targetTicket.writtenOffAt = nowIso;
      targetTicket.writtenOffBy = reviewer;
    }

    // 3. Cloud update
    try {
      await reconcileTicketInCloud(modalTicket.ticket.id, true, cleanReason, reviewer);
    } catch (error) {
      console.warn("Could not sync write-off to Firestore, cached locally:", error);
    } finally {
      setIsSubmitting(false);
      setModalTicket(null);
      setToastMessage("Berhasil melakukan write-off pada kartu tiket.");
      setTimeout(() => setToastMessage(""), 3500);
    }
  };

  // Undo write-off action (FIXED: explicit isWrittenOff: false in overrides and direct ticket mutation)
  const handleUndoWriteOff = async (ticketId: string) => {
    // Set isWrittenOff explicitly to false so it won't fallback to t.isWrittenOff = true
    const newOverrides = {
      ...localOverrides,
      [ticketId]: {
        isWrittenOff: false,
        reason: "",
        at: "",
        by: ""
      }
    };
    setLocalOverrides(newOverrides);
    try {
      localStorage.setItem(localCacheKey, JSON.stringify(newOverrides));
    } catch (e) {}

    // Direct memory update
    const targetTicket = tickets.find(t => t.id === ticketId);
    if (targetTicket) {
      targetTicket.isWrittenOff = false;
      targetTicket.writeOffReason = "";
      targetTicket.writtenOffAt = "";
      targetTicket.writtenOffBy = "";
    }

    try {
      await reconcileTicketInCloud(ticketId, false);
    } catch (error) {
      console.warn("Could not sync undo write-off to Firestore:", error);
    }

    setConfirmCancelTicketId(null);
    setToastMessage("Dispensasi write-off berhasil dibatalkan. Kartu kembali menjadi pelanggaran aktif.");
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Generate WhatsApp text
  const whatsappSummaryText = useMemo(() => {
    const divider = "━━━━━━━━━━━━━━━━━━━━";
    const periodLabel = activePeriod.label;
    const periodSub = activePeriod.subtext;

    let text = `📊 *REKAP OPERASIONAL & PERFORMA BULANAN*\n`;
    text += `🏪 *Daily Bike - Cabang ${branchLabel}*\n`;
    text += `📅 *Periode:* ${periodLabel} (${periodSub})\n`;
    text += `${divider}\n\n`;

    // Ringkasan Utama
    text += `📈 *RINGKASAN SERVIS (HASIL REKONSILIASI)*\n`;
    text += `• Total Servis Selesai: *${stats.totalCards} unit*\n`;
    text += `• Selesai Bersih (Non-Garansi): *${stats.totalSelesaiNonGaransi} unit*\n`;
    text += `• Unit Klaim Garansi: *${stats.totalGaransi} unit*\n`;
    text += `• Tingkat Keberhasilan Selesai: *${stats.netSuccessRate}%* `;
    if (stats.netSuccessRate !== stats.grossSuccessRate) {
      text += `_(Awal: ${stats.grossSuccessRate}%)_\n`;
    } else {
      text += `\n`;
    }
    text += `\n`;

    // Status SOP
    text += `⚠️ *STATUS KEDISIPLINAN SOP*\n`;
    text += `• Total Temuan Awal (Gross): *${stats.grossProblemsCount} kasus*\n`;
    text += `• Disetujui Write-Off / Dispensasi: *${stats.writtenOffCount} kasus*\n`;
    text += `  - Dispensasi Admin: *${stats.totalAdminDispensasi} kasus*\n`;
    text += `  - Dispensasi Mekanik: *${stats.totalMechanicDispensasi} kasus*\n`;
    text += `• *Pelanggaran Final (Net):* *${stats.netProblemsCount} kasus*\n\n`;

    // Admin SOP Summary
    if (includeAdminSummary) {
      text += `📋 *KEDISIPLINAN SOP ADMIN (NET)*\n`;
      text += `• Total Tiket Dikelola: *${stats.totalCards} unit*\n`;
      text += `• Skor Kepatuhan: *${stats.netAdminComplianceScore}%*`;
      if (stats.netAdminComplianceScore !== stats.grossAdminComplianceScore) {
        text += ` _(Sebelum Write-Off: ${stats.grossAdminComplianceScore}%)_`;
      }
      text += `\n`;

      if (stats.netAdminPenalties === 0 && stats.totalAdminDispensasi === 0) {
        text += `• Status: ✅ Tertib SOP (0 Pelanggaran)\n`;
      } else if (stats.netAdminPenalties === 0) {
        text += `• Status: ✅ Tertib SOP (Semua terselesaikan via dispensasi)\n`;
      } else {
        text += `• Status: ⚠️ ${stats.netAdminPenalties}x Pelanggaran SOP Aktif\n`;
      }

      text += `• Telat Update Antrian: *${stats.netAdminTelatAntrian}x*`;
      if (stats.dispensasiAdminTelatAntrian > 0) {
        text += ` _(Di-write off: ${stats.dispensasiAdminTelatAntrian}x)_\n`;
      } else {
        text += `\n`;
      }

      text += `• Telat Follow-Up: *${stats.netAdminTelatFollowUp}x*`;
      if (stats.dispensasiAdminTelatFollowUp > 0) {
        text += ` _(Di-write off: ${stats.dispensasiAdminTelatFollowUp}x)_\n`;
      } else {
        text += `\n`;
      }

      text += `• Total Dispensasi Admin Diterima: *${stats.totalAdminDispensasi} kasus*\n\n`;
    }

    // Mechanic Summary
    if (includeMechanicSummary) {
      text += `👨‍🔧 *PERFORMA & DISIPLIN MEKANIK (NET)*\n`;
      // User requirement: ONLY list down mechanic who in that month has active card working (service > 0 unit)
      const activeMechanics = stats.mechanicBreakdown.filter(m => (m.selesai + m.garansi) > 0);

      if (activeMechanics.length === 0) {
        text += `_Tidak ada mekanik aktif dengan unit servis pada periode ini._\n\n`;
      } else {
        activeMechanics.forEach((m, idx) => {
          text += `${idx + 1}. *${m.name}*\n`;
          text += `   • Servis: ${m.selesai} unit | Garansi: ${m.garansi} unit\n`;
          text += `   • Skor Kepatuhan: *${m.netComplianceScore}%*`;
          if (m.netComplianceScore !== m.grossComplianceScore) {
            text += ` _(Sebelum Write-Off: ${m.grossComplianceScore}%)_`;
          }
          text += `\n`;

          if (m.netPenalties === 0 && m.writtenOffCount === 0) {
            text += `   • Status: ✅ Tertib SOP (0 Pelanggaran)\n`;
          } else {
            const detailPenalties: string[] = [];
            if (m.netTelatService > 0) detailPenalties.push(`${m.netTelatService}x Telat Mulai Servis`);
            if (m.netTelatSelesai > 0) detailPenalties.push(`${m.netTelatSelesai}x Telat Selesai`);
            if (m.netResiHilang > 0) detailPenalties.push(`${m.netResiHilang}x Resi Hilang`);
            
            if (detailPenalties.length > 0) {
              text += `   • Pelanggaran Net: ${detailPenalties.join(", ")}\n`;
            } else {
              text += `   • Pelanggaran Net: 0 (Semua terselesaikan via dispensasi)\n`;
            }
            if (m.writtenOffCount > 0) {
              text += `   • Dispensasi Mekanik Diterima: ${m.writtenOffCount} kasus\n`;
            }
          }
        });
        text += `\n`;
      }
    }

    // Detail Justifikasi / Write-Off (Hanya tampilkan jika ADA item yang di-write-off pada periode ini)
    if (includeWrittenOffList && stats.writtenOffItems.length > 0) {
      text += `📝 *CATATAN JUSTIFIKASI & DISPENSASI (WRITE-OFF)*\n`;
      stats.writtenOffItems.forEach((item, idx) => {
        const t = item.ticket;
        const ticketNo = t.ticketNumber ? `#${t.ticketNumber}` : `#${t.id.slice(-4)}`;
        const bike = t.unitSepeda || "Sepeda";
        
        // Categorize who this write off belongs to
        const hasAdmin = item.problems.some(p => p.category === "admin");
        const hasMechanic = item.problems.some(p => p.category === "mechanic");
        let categoryLabel = "";
        if (hasAdmin && hasMechanic) {
          categoryLabel = `[Admin & Mekanik: ${item.mechanicName}]`;
        } else if (hasAdmin) {
          categoryLabel = `[Tanggung Jawab: Admin]`;
        } else if (hasMechanic) {
          categoryLabel = `[Tanggung Jawab: Mekanik (${item.mechanicName})]`;
        } else {
          categoryLabel = `[Klaim Garansi]`;
        }

        const flagsStr = item.problems.map(p => p.label).join(", ");
        text += `${idx + 1}. *${ticketNo}* (${bike}) - ${categoryLabel}\n`;
        text += `   • PIC Mekanik Tiket: ${item.mechanicName}\n`;
        text += `   • Temuan: ${flagsStr}\n`;
        text += `   • *Alasan Write-Off:* "${item.writeOffReason || "-"}"\n`;
        if (item.writtenOffBy) {
          text += `   • Divalidasi Oleh: ${item.writtenOffBy}\n`;
        }
      });
      text += `\n`;
    }

    // Catatan Tambahan Supervisor jika ada
    if (customNotes.trim() !== "") {
      text += `💬 *CATATAN TAMBAHAN:* \n${customNotes.trim()}\n\n`;
    }

    text += `${divider}`;

    return text;
  }, [
    branchLabel,
    activePeriod,
    stats,
    includeAdminSummary,
    includeMechanicSummary,
    includeWrittenOffList,
    customNotes
  ]);

  // Copy to clipboard
  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappSummaryText);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch (err) {
      console.error("Gagal menyalin format WA:", err);
    }
  };

  // Open WhatsApp Web
  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappSummaryText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  // ==========================================
  // VIEW: PIN AUTHENTICATION GATE (IF LOCKED)
  // ==========================================
  if (!isUnlocked) {
    return (
      <div className="py-12 px-4 flex items-center justify-center animate-fadeIn">
        <div className="bg-white max-w-md w-full rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6 text-center">
          {/* Lock Icon Badge */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
            <Lock size={32} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Keamanan Rekonsiliasi
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Menu rekonsiliasi masalah bulanan dan laporan WhatsApp dilindungi PIN otorisasi. Silakan masukkan PIN untuk melanjutkan.
            </p>
          </div>

          {/* PIN Form */}
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="relative max-w-xs mx-auto">
              <input
                type={showPinText ? "text" : "password"}
                maxLength={10}
                autoFocus
                placeholder="Masukkan PIN (Default: 7788)"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (pinError) setPinError("");
                }}
                className={`w-full py-3.5 px-4 text-center font-mono font-black text-lg tracking-widest bg-slate-50 border rounded-2xl focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  pinError
                    ? "border-rose-400 focus:ring-rose-500 text-rose-700 bg-rose-50/30"
                    : "border-slate-200 focus:ring-slate-900 text-slate-800"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPinText(!showPinText)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                title={showPinText ? "Sembunyikan PIN" : "Tampilkan PIN"}
              >
                {showPinText ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {pinError && (
              <div className="bg-rose-50 text-rose-700 text-xs font-bold p-3 rounded-xl border border-rose-200 flex items-center justify-center gap-2 animate-shake">
                <AlertCircle size={16} className="shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={!pinInput.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlock size={16} className="text-emerald-400" />
                <span>Buka Rekonsiliasi</span>
              </button>

              {onBackToOperational && (
                <button
                  type="button"
                  onClick={onBackToOperational}
                  className="w-full py-2.5 px-4 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Kembali ke SOP & Kualitas Operasional
                </button>
              )}
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Shield size={13} className="text-emerald-500" />
            <span>PIN Awal Default: <b>7788</b> (Dapat diubah setelah masuk)</span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: UNLOCKED RECONCILIATION DASHBOARD
  // ==========================================
  return (
    <div className="space-y-8 animate-fadeIn relative">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold py-3 px-5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER: TITLE & SECURITY ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shrink-0">
            <FileCheck2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Rekonsiliasi Masalah Bulanan & Rekap WhatsApp
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black uppercase">
                Terbuka
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Evaluasi setiap temuan kendala & SOP untuk justifikasi write-off resmi dan publikasi rekap WA.
            </p>
          </div>
        </div>

        {/* Security controls: Change PIN & Lock */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setShowChangePinModal(true);
              setOldPin("");
              setNewPin("");
              setConfirmNewPin("");
              setChangePinError("");
              setChangePinSuccess("");
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
            title="Ubah PIN akses rekonsiliasi"
          >
            <Key size={14} className="text-amber-500" />
            <span>Ubah PIN</span>
          </button>

          <button
            onClick={() => {
              setIsUnlocked(false);
              setPinInput("");
              setToastMessage("Halaman rekonsiliasi berhasil dikunci kembali.");
              setTimeout(() => setToastMessage(""), 2500);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer shadow-xs"
            title="Kunci kembali menu ini"
          >
            <Lock size={14} className="text-slate-500" />
            <span>Kunci Halaman</span>
          </button>
        </div>
      </div>

      {/* SUMMARY STATS TILES (GROSS VS RECONCILED VS NET) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Tingkat Keberhasilan Selesai (Net Reconciled) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Tingkat Keberhasilan Selesai
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {stats.netSuccessRate}%
                </span>
                {stats.netSuccessRate !== stats.grossSuccessRate && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    +{stats.netSuccessRate - stats.grossSuccessRate}% Penyesuaian
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Gross Awal: <b>{stats.grossSuccessRate}%</b></span>
            <span>Bersih: <b>{stats.totalSelesaiNonGaransi} unit</b></span>
          </div>
        </div>

        {/* CARD 2: Total Temuan Masalah & Pelanggaran */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Temuan Pelanggaran SOP
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {stats.netProblemsCount}
                </span>
                <span className="text-xs text-slate-400 font-semibold">Kasus Net</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Gross Awal: <b>{stats.grossProblemsCount}</b></span>
            <span className="text-rose-600 font-bold">Aktif: {stats.netProblemsCount}</span>
          </div>
        </div>

        {/* CARD 3: Disetujui Write-Off / Dispensasi */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total Di-Write Off / Dispensasi
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
                  {stats.writtenOffCount}
                </span>
                <span className="text-xs text-emerald-600 font-bold">Kasus Tervalidasi</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ThumbsUp size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Admin: <b>{stats.totalAdminDispensasi}</b></span>
            <span>Mekanik: <b>{stats.totalMechanicDispensasi}</b></span>
          </div>
        </div>

        {/* CARD 4: Skor Kepatuhan Admin SOP (Net vs Gross) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Skor Kepatuhan Admin (SOP)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {stats.netAdminComplianceScore}%
                </span>
                {stats.netAdminComplianceScore !== stats.grossAdminComplianceScore && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    +{stats.netAdminComplianceScore - stats.grossAdminComplianceScore}%
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Award size={20} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Gross Awal: <b>{stats.grossAdminComplianceScore}%</b></span>
            <span className={stats.netAdminPenalties > 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
              Pelanggaran Net: {stats.netAdminPenalties}x
            </span>
          </div>
        </div>
      </div>

      {/* EVALUASI KEPATUHAN SOP: ADMIN & MEKANIK AKTIF */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black">
              <Award size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Peringkat Kepatuhan SOP (Hasil Rekonsiliasi)
              </h4>
              <p className="text-[11px] text-slate-400">
                Memuat kepatuhan SOP Admin dan seluruh Mekanik yang aktif mengerjakan unit di periode ini.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {stats.mechanicBreakdown.filter(m => (m.selesai + m.garansi) > 0).length} Mekanik Aktif ({stats.totalCards} Unit Servis)
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Admin Card */}
          <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                Admin Cabang
              </span>
              <span className="text-xs font-mono font-black text-slate-900">
                {stats.netAdminComplianceScore}%
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 truncate">
              Admin & Antrian
            </div>
            <div className="text-[11px] text-slate-600 space-y-0.5">
              <div className="flex justify-between">
                <span>Total Tiket:</span>
                <b>{stats.totalCards} unit</b>
              </div>
              <div className="flex justify-between">
                <span>Telat Antrian Net:</span>
                <b className={stats.netAdminTelatAntrian > 0 ? "text-amber-600" : "text-emerald-700"}>{stats.netAdminTelatAntrian}x</b>
              </div>
              <div className="flex justify-between">
                <span>Telat Follow-Up Net:</span>
                <b className={stats.netAdminTelatFollowUp > 0 ? "text-amber-600" : "text-emerald-700"}>{stats.netAdminTelatFollowUp}x</b>
              </div>
              {stats.totalAdminDispensasi > 0 && (
                <div className="flex justify-between text-emerald-700 text-[10px]">
                  <span>Dispensasi Disetujui:</span>
                  <b>{stats.totalAdminDispensasi}x</b>
                </div>
              )}
            </div>
          </div>

          {/* Active Mechanics Cards */}
          {stats.mechanicBreakdown
            .filter(m => (m.selesai + m.garansi) > 0)
            .map(m => (
              <div key={m.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Mekanik PIC
                  </span>
                  <span className={`text-xs font-mono font-black ${
                    m.netComplianceScore === 100 ? "text-emerald-600" : m.netComplianceScore >= 80 ? "text-amber-600" : "text-rose-600"
                  }`}>
                    {m.netComplianceScore}%
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 truncate">
                  {m.name}
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Pengerjaan:</span>
                    <b>{m.selesai} unit {m.garansi > 0 ? `(${m.garansi} garansi)` : ""}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggaran Net:</span>
                    <b className={m.netPenalties > 0 ? "text-rose-600" : "text-emerald-700"}>
                      {m.netPenalties === 0 ? "0 (Tertib SOP)" : `${m.netPenalties}x`}
                    </b>
                  </div>
                  {m.writtenOffCount > 0 && (
                    <div className="flex justify-between text-emerald-700 text-[10px]">
                      <span>Dispensasi:</span>
                      <b>{m.writtenOffCount}x</b>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* TWO COLUMN WORKSPACE: LEFT = PROBLEM TICKETS LIST & RECONCILIATION, RIGHT = WHATSAPP GENERATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANEL: PROBLEM CARDS & WRITE-OFF ACTIONS (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Filter size={18} className="text-slate-600" />
                  Daftar Temuan Masalah & Justifikasi
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Pilih kartu bermasalah untuk menuliskan alasan dispensasi atau membatalkannya.
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm font-black"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semua ({problemItems.length})
                </button>
                <button
                  onClick={() => setStatusFilter("pending")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    statusFilter === "pending"
                      ? "bg-white text-rose-700 shadow-sm font-black"
                      : "text-slate-500 hover:text-rose-600"
                  }`}
                >
                  Aktif ({stats.netProblemsCount})
                </button>
                <button
                  onClick={() => setStatusFilter("written_off")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    statusFilter === "written_off"
                      ? "bg-white text-emerald-700 shadow-sm font-black"
                      : "text-slate-500 hover:text-emerald-600"
                  }`}
                >
                  Di-Write Off ({stats.writtenOffCount})
                </button>
              </div>
            </div>

            {/* Filter by Category & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
              <div className="sm:col-span-5 relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari tiket, customer, sepeda, alasan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="sm:col-span-7 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-[11px] font-bold">
                <span className="text-slate-400 uppercase text-[10px] whitespace-nowrap mr-1">Kategori:</span>
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    categoryFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setCategoryFilter("admin")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    categoryFilter === "admin" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  Admin SOP
                </button>
                <button
                  onClick={() => setCategoryFilter("mechanic")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    categoryFilter === "mechanic" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  Mekanik SOP
                </button>
                <button
                  onClick={() => setCategoryFilter("warranty")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    categoryFilter === "warranty" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  Garansi
                </button>
              </div>
            </div>
          </div>

          {/* PROBLEM CARDS LIST */}
          <div className="space-y-3.5">
            {filteredProblemItems.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-base font-black text-slate-800 uppercase">
                  Tidak Ada Masalah yang Sesuai Filter
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {problemItems.length === 0
                    ? `Seluruh pengerjaan dan SOP pada periode ${activePeriod.label} tertib 100%! Tidak ada temuan kendala.`
                    : "Tidak ada kartu yang cocok dengan kriteria pencarian atau status filter saat ini."}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setCategoryFilter("all");
                    }}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            ) : (
              filteredProblemItems.map((item) => {
                const t = item.ticket;
                const ticketNo = t.ticketNumber ? `#${t.ticketNumber}` : `#${t.id.slice(-4)}`;
                const isWritten = item.isWrittenOff;

                // Determine classification for UI badge
                const hasAdmin = item.problems.some(p => p.category === "admin" || p.code === "KENDALA_FOLLOW_UP");
                const hasMechanic = item.problems.some(p => p.category === "mechanic");

                return (
                  <div
                    key={t.id}
                    className={`bg-white rounded-2xl border transition-all p-4.5 sm:p-5 shadow-sm space-y-3.5 ${
                      isWritten
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Header bar: Ticket No, Responsibility badge, Status badge, & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-xs">
                          {ticketNo}
                        </span>
                        <span className="font-bold text-xs text-slate-800">
                          {t.customerName}
                        </span>
                        {t.phone && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({t.phone})
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-bold">
                          • {t.unitSepeda}
                        </span>
                      </div>

                      {/* Badges: Tanggung Jawab & Status */}
                      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        {hasAdmin && !hasMechanic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider">
                            Tanggung Jawab: Admin
                          </span>
                        )}
                        {hasMechanic && !hasAdmin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                            Tanggung Jawab: Mekanik
                          </span>
                        )}
                        {hasAdmin && hasMechanic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider">
                            Admin & Mekanik
                          </span>
                        )}

                        {isWritten ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider border border-emerald-300">
                            <CheckCircle2 size={13} className="text-emerald-700" />
                            Dispensasi / Written-Off
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-black uppercase tracking-wider border border-rose-200">
                            <AlertCircle size={13} className="text-rose-700" />
                            Pelanggaran Aktif
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Details & Infractions Badges */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-bold uppercase mr-1">
                          Temuan Masalah:
                        </span>
                        {item.problems.map((prob, pIdx) => (
                          <span
                            key={pIdx}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${prob.colorClass}`}
                          >
                            <AlertTriangle size={12} />
                            {prob.label}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Wrench size={13} className="text-slate-400" />
                          PIC Mekanik Tiket: <b className="text-slate-800 font-bold">{item.mechanicName}</b>
                        </span>
                        {t.timestamps?.finished && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock size={13} className="text-slate-400" />
                            Selesai: {new Date(t.timestamps.finished).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        )}
                        {t.followUpResult && (
                          <span className="text-slate-500">
                            Follow-Up: <b className={t.followUpResult === "Kendala" ? "text-rose-600" : "text-emerald-600"}>{t.followUpResult}</b>
                          </span>
                        )}
                      </div>

                      {t.notes && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 font-mono text-[11px]">
                          <span className="font-bold text-slate-700">Catatan Tiket:</span> {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Bottom: If Written Off, display Reason Box. Else show Write-Off Action Button */}
                    {isWritten ? (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1">
                            <ThumbsUp size={13} className="text-emerald-700" />
                            Alasan Write-Off Divalidasi:
                          </div>
                          <p className="text-xs text-emerald-950 font-bold italic">
                            "{item.writeOffReason}"
                          </p>
                          <div className="text-[10px] text-emerald-700 font-medium">
                            Divalidasi Oleh: <b>{item.writtenOffBy || "Supervisor"}</b> •{" "}
                            {item.writtenOffAt ? new Date(item.writtenOffAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Tervalidasi"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            onClick={() => handleOpenWriteOffModal(item)}
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-white text-emerald-800 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-all cursor-pointer"
                          >
                            Edit Alasan
                          </button>
                          <button
                            onClick={() => setConfirmCancelTicketId(t.id)}
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-white text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-all cursor-pointer"
                            title="Batalkan write off dan kembalikan ke masalah aktif"
                          >
                            Batalkan Write-Off
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400 font-semibold italic">
                          {hasAdmin && !hasMechanic
                            ? "Pelanggaran ini berada di ranah Admin SOP."
                            : hasMechanic && !hasAdmin
                            ? `Pelanggaran ini dibebankan pada PIC Mekanik (${item.mechanicName}).`
                            : "Tiket ini mengurangi kepatuhan SOP."}
                        </span>
                        <button
                          onClick={() => handleOpenWriteOffModal(item)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
                        >
                          <FileCheck2 size={14} className="text-emerald-400" />
                          <span>Beri Alasan & Write-Off</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: RECONCILED WHATSAPP RECAP GENERATOR (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <MessageSquare size={18} className="text-emerald-600" />
                  Format Pesan WhatsApp
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Rekap bulanan bersih siap salin & kirim ke grup WhatsApp.
                </p>
              </div>

              <button
                onClick={handleCopyWhatsApp}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
                  copiedSuccess
                    ? "bg-emerald-600 text-white scale-105"
                    : "bg-slate-900 hover:bg-slate-800 text-white hover:scale-102"
                }`}
              >
                {copiedSuccess ? (
                  <>
                    <Check size={14} />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>
            </div>

            {/* Config Checkboxes */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Sesuaikan Isi Laporan WA:
              </span>
              <div className="space-y-2 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAdminSummary}
                    onChange={(e) => setIncludeAdminSummary(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>Sertakan Kedisiplinan SOP Admin (Net)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMechanicSummary}
                    onChange={(e) => setIncludeMechanicSummary(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>Sertakan Performa & Disiplin Mekanik PIC (Net)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWrittenOffList}
                    onChange={(e) => setIncludeWrittenOffList(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>Sertakan Rincian Catatan Dispensasi Write-Off</span>
                </label>
              </div>
            </div>

            {/* Custom Notes Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Catatan Tambahan Supervisor (Opsional):</span>
                <span className="text-[10px] text-slate-400 font-normal">Akan muncul di akhir pesan</span>
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Misal: Terima kasih atas kerja keras tim bulan ini. Bulan depan kita targetkan 0 telat servis..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
              />
            </div>

            {/* Live Message Preview Window */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Pratinjau Pesan Siap Kirim:
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  Format WhatsApp Terstruktur
                </span>
              </div>
              <div className="bg-[#efeae2] p-4 rounded-2xl border border-slate-300 shadow-inner max-h-[360px] overflow-y-auto">
                <div className="bg-white p-3.5 rounded-xl shadow-xs text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed select-text font-mono text-[11.5px]">
                  {whatsappSummaryText}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleCopyWhatsApp}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {copiedSuccess ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedSuccess ? "Tersalin!" : "Salin Format"}</span>
              </button>

              <button
                onClick={handleOpenWhatsApp}
                className="py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01]"
              >
                <Send size={16} />
                <span>Buka WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL: JUSTIFIKASI MASALAH KARTU TIKET     */}
      {/* ========================================== */}
      {modalTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-2">
                  <FileCheck2 size={12} />
                  Formulir Rekonsiliasi & Write-Off
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  Justifikasi Masalah Kartu Tiket
                </h3>
                <p className="text-xs text-slate-400">
                  Tiket {modalTicket.ticket.ticketNumber ? `#${modalTicket.ticket.ticketNumber}` : `#${modalTicket.ticket.id.slice(-4)}`} • {modalTicket.ticket.customerName} ({modalTicket.ticket.unitSepeda})
                </p>
              </div>

              <button
                onClick={() => setModalTicket(null)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Infractions Detected */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                  Temuan Pelanggaran yang Akan Di-Write Off:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {modalTicket.problems.map((p, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${p.colorClass}`}
                    >
                      <AlertTriangle size={13} />
                      {p.label}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-slate-600 font-medium pt-1">
                  PIC Mekanik Tiket: <b className="text-slate-900">{modalTicket.mechanicName}</b>
                </div>
              </div>

              {/* Free Text Reason Input (No presets) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Alasan / Keterangan Write-Off Lengkap:</span>
                  <span className="text-[10px] text-rose-500 font-bold">*Wajib Diisi</span>
                </label>
                <textarea
                  rows={4}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Ketikkan alasan spesifik dan valid mengapa kendala / keterlambatan ini dapat dimaklumi atau di-write off..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                />
              </div>

              {/* Reviewer / Supervisor Dropdown (No pre-fill, just dropdown: Supervisor or Owner) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Divalidasi Oleh:</span>
                  <span className="text-[10px] text-rose-500 font-bold">*Wajib Dipilih</span>
                </label>
                <select
                  value={reviewerInput}
                  onChange={(e) => setReviewerInput(e.target.value)}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer"
                >
                  <option value="">-- Pilih Validator --</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalTicket(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || !reasonInput.trim() || !reviewerInput}
                onClick={handleSaveWriteOff}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Konfirmasi Write-Off</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: KONFIRMASI BATALKAN WRITE-OFF       */}
      {/* ========================================== */}
      {confirmCancelTicketId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Batalkan Write-Off?
              </h3>
              <p className="text-xs text-slate-500">
                Kartu ini akan kembali tercatat sebagai pelanggaran / masalah aktif pada rekap performa dan pesan WhatsApp.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setConfirmCancelTicketId(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => handleUndoWriteOff(confirmCancelTicketId)}
                className="flex-1 py-2.5 text-xs font-black uppercase text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: UBAH PIN KEAMANAN REKONSILIASI      */}
      {/* ========================================== */}
      {showChangePinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    Ubah PIN Keamanan
                  </h3>
                  <p className="text-xs text-slate-400">
                    Perbarui PIN otorisasi akses rekonsiliasi bulanan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChangePinModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePin} className="p-6 space-y-4">
              {changePinError && (
                <div className="bg-rose-50 text-rose-700 text-xs font-bold p-3 rounded-xl border border-rose-200 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{changePinError}</span>
                </div>
              )}

              {changePinSuccess && (
                <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{changePinSuccess}</span>
                </div>
              )}

              {/* 1. Enter Old PIN */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  PIN Lama:
                </label>
                <div className="relative">
                  <input
                    type={showOldPin ? "text" : "password"}
                    required
                    placeholder="Masukkan PIN saat ini (Default: 7788)"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    className="w-full p-3 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPin(!showOldPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showOldPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 2. Enter New PIN */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  PIN Baru:
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? "text" : "password"}
                    required
                    minLength={4}
                    placeholder="Masukkan PIN baru (min 4 angka)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full p-3 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 3. New PIN Confirmation */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Konfirmasi PIN Baru:
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPin ? "text" : "password"}
                    required
                    minLength={4}
                    placeholder="Ketik ulang PIN baru"
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    className="w-full p-3 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!oldPin.trim() || !newPin.trim() || !confirmNewPin.trim()}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Simpan PIN Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyReconciliationTab;
