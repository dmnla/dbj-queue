import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  Check, 
  Link, 
  FileText, 
  Clipboard, 
  User, 
  CheckSquare, 
  Plus, 
  Users, 
  Clock, 
  Ban, 
  Play, 
  Wrench,
  Search,
  ChevronDown
} from "lucide-react";
import { Ticket, MechanicDefinition, Branch, flag_type } from "../types";
import { updateTicketInCloud, updateOperationalConfigInCloud, isTicketExcludedFromFollowUp } from "../services/ticketService";

interface DebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  tickets: Ticket[];
  mechanics: MechanicDefinition[];
  isBengkelOpen: boolean;
  isOvertimeActive: boolean;
  isDebriefInProgress: boolean;
  debriefFrozenAt: string | null;
  overtimeTicketIds: string[];
  overtimeStoppedAt?: string | null;
}

export const calculateTicketDuration = (
  t: Ticket,
  isBengkelOpen: boolean,
  isOvertimeActive: boolean,
  isDebriefInProgress: boolean,
  debriefFrozenAt: string | null,
  overtimeTicketIds: string[],
  overtimeStoppedAt?: string | null
): string => {
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
  let endMs = new Date().getTime();

  // If ticket status is active or pending, freeze time calculation if conditions apply
  if (t.status === "active" || t.status === "pending") {
    if (isDebriefInProgress && debriefFrozenAt) {
      endMs = new Date(debriefFrozenAt).getTime();
    } else if (!isBengkelOpen) {
      const isOvertimeTicket = overtimeTicketIds.includes(t.id);
      if (isOvertimeActive) {
        if (isOvertimeTicket) {
          endMs = new Date().getTime();
        } else {
          if (debriefFrozenAt) {
            endMs = new Date(debriefFrozenAt).getTime();
          }
        }
      } else {
        if (isOvertimeTicket && overtimeStoppedAt) {
          endMs = new Date(overtimeStoppedAt).getTime();
        } else if (debriefFrozenAt) {
          endMs = new Date(debriefFrozenAt).getTime();
        }
      }
    }
  }

  const diffMs = Math.max(0, endMs - startMs);
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  const daysStr = String(days).padStart(2, "0");
  const hoursStr = String(hours).padStart(2, "0");

  return `${daysStr} Hari ${hoursStr} Jam`;
};

export const DebriefModal: React.FC<DebriefModalProps> = ({
  isOpen,
  onClose,
  branch,
  tickets,
  mechanics,
  isBengkelOpen,
  isOvertimeActive,
  isDebriefInProgress,
  debriefFrozenAt,
  overtimeTicketIds,
  overtimeStoppedAt = null,
}) => {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);

  // Step 3 States: Reconcile Manual Cards
  const [dealposOrders, setDealposOrders] = useState<any[]>([]);
  const [isLoadingDealpos, setIsLoadingDealpos] = useState(false);
  const [dealposSearchTerm, setDealposSearchTerm] = useState("");
  const [reconcileInputs, setReconcileInputs] = useState<{ [ticketId: string]: string }>({});
  const [reconcileSaved, setReconcileSaved] = useState<{ [ticketId: string]: boolean }>({});
  const [step3Searches, setStep3Searches] = useState<{ [ticketId: string]: string }>({});
  const [step3DropdownOpen, setStep3DropdownOpen] = useState<{ [ticketId: string]: boolean }>({});
  const [step3ManualInvoice, setStep3ManualInvoice] = useState<{ [ticketId: string]: string }>({});
  const [step3InvoiceSearchResult, setStep3InvoiceSearchResult] = useState<{
    [ticketId: string]: {
      Number: string;
      CustomerName: string;
      loading: boolean;
      found: boolean;
      error?: string;
    };
  }>({});

  const searchInvoiceForTicket = async (ticketId: string) => {
    const invInput = step3ManualInvoice[ticketId]?.trim() || "";
    if (!invInput) return;

    setStep3InvoiceSearchResult(prev => ({
      ...prev,
      [ticketId]: { Number: "", CustomerName: "", loading: true, found: false }
    }));

    try {
      const cleanNum = invInput.replace(/^#+/, "").trim();
      const res = await fetch(`/api/dealpos?branch=${branch}&invoiceNumber=${encodeURIComponent(cleanNum)}`);
      if (!res.ok) {
        throw new Error(`Invoice tidak ditemukan atau DealPOS error (Status ${res.status})`);
      }

      const data = await res.json();
      const num = data.Number;
      const customerName = data.Customer?.Name || data.CustomerName || "Nama Tidak Diketahui";

      if (!num) {
        throw new Error("Format invoice salah atau tidak ditemukan.");
      }

      setStep3InvoiceSearchResult(prev => ({
        ...prev,
        [ticketId]: {
          Number: num,
          CustomerName: customerName,
          loading: false,
          found: true
        }
      }));
      
      setReconcileInputs(prev => ({
        ...prev,
        [ticketId]: num
      }));

    } catch (err: any) {
      setStep3InvoiceSearchResult(prev => ({
        ...prev,
        [ticketId]: {
          Number: "",
          CustomerName: "",
          loading: false,
          found: false,
          error: err.message || "Gagal menghubungi DealPOS"
        }
      }));
    }
  };

  // Step 4 States: Assign Mechanics & Activate waiting
  const [selectedMechanics, setSelectedMechanics] = useState<{ [ticketId: string]: string }>({});
  const [serviceSaved, setServiceSaved] = useState<{ [ticketId: string]: boolean }>({});

  // Step 5 States: Anomaly reason
  const [anomalyReasons, setAnomalyReasons] = useState<{ [ticketId: string]: string }>({});
  const [anomalyTelatUpdate, setAnomalyTelatUpdate] = useState<{ [ticketId: string]: boolean }>({});
  const [anomalySaved, setAnomalySaved] = useState<{ [ticketId: string]: boolean }>({});

  // Step 6 States: Physical Receipt checklist
  const [missingReceipts, setMissingReceipts] = useState<{ [ticketId: string]: boolean }>({});
  const [receiptSaved, setReceiptSaved] = useState<{ [ticketId: string]: boolean }>({});

  // Step 7 States: Overtime
  const [hasOvertimeToday, setHasOvertimeToday] = useState<boolean | null>(null);
  const [selectedOvertimeTickets, setSelectedOvertimeTickets] = useState<string[]>([]);
  const [confirmOvertimeSelesai, setConfirmOvertimeSelesai] = useState(false);
  const [monthlyCopied, setMonthlyCopied] = useState(false);

  const hasMonthlyRekap = useMemo(() => {
    return new Date().getDate() === 28;
  }, []);

  const eligibleOvertimeTickets = useMemo(() => {
    return tickets.filter(t => t.branch === branch && (t.status === "waiting" || t.status === "active" || t.status === "pending"));
  }, [tickets, branch]);

  const isOvertimeSelectionValid = useMemo(() => {
    if (selectedOvertimeTickets.length === 0) return false;
    const selectedWaiting = tickets.filter(t => t.branch === branch && selectedOvertimeTickets.includes(t.id) && t.status === "waiting");
    return !selectedWaiting.some(t => !t.overtimeMechanic);
  }, [tickets, selectedOvertimeTickets, branch]);

  // Load manual tickets needing reconcile
  const manualTickets = useMemo(() => {
    return tickets.filter(t => !t.dealposOrderId && (t.status === "waiting" || t.status === "active" || t.status === "pending" || t.status === "ready"));
  }, [tickets]);

  // Load waiting tickets needing service review
  const waitingTickets = useMemo(() => {
    return tickets.filter(t => t.status === "waiting");
  }, [tickets]);

  // Load anomaly tickets
  const isToday = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isLateAfternoonStart = (t: Ticket) => {
    if (!t.timestamps?.called) return false;
    if (!isToday(t.timestamps.called)) return false;
    const d = new Date(t.timestamps.called);
    const hour = d.getHours();
    const min = d.getMinutes();
    return hour > 16 || (hour === 16 && min >= 45);
  };

  const anomalyTickets = useMemo(() => {
    return tickets.filter(t => {
      const hasAnomalyFlag = t.flags?.includes("ANOMALI_DURASI_SERVICE" as any);
      const isSelesaiHariIni = (t.status === "ready" || t.status === "done" || t.status === "taken") && (isToday(t.timestamps.ready));
      const isSelesaiAtauActive = t.status === "active" || isSelesaiHariIni;
      const isTraditionalAnomaly = hasAnomalyFlag && isSelesaiAtauActive;

      const isLateStart = isLateAfternoonStart(t);

      return isTraditionalAnomaly || isLateStart;
    });
  }, [tickets]);

  // Load ready tickets for physical receipt check
  const readyTickets = useMemo(() => {
    return tickets.filter(t => t.status === "ready");
  }, [tickets]);

  const unclearedManualTickets = useMemo(() => {
    return manualTickets.filter(t => !reconcileSaved[t.id]);
  }, [manualTickets, reconcileSaved]);

  const unclearedAnomalies = useMemo(() => {
    return anomalyTickets.filter(t => {
      const isSavedSaved = anomalySaved[t.id] || 
        t.flags?.includes("TELAT_UPDATE_SELESAI" as any) || 
        t.flags?.includes("TELAT_UPDATE_SERVICE" as any) || 
        t.notes?.includes("[Reason:");
      return !isSavedSaved;
    });
  }, [anomalyTickets, anomalySaved]);

  const unclearedReceipts = useMemo(() => {
    return readyTickets.filter(t => !receiptSaved[t.id]);
  }, [readyTickets, receiptSaved]);

  // Fetch Dealpos open parked orders for step 3
  useEffect(() => {
    if (isOpen && step === 3) {
      const fetchOrders = async () => {
        setIsLoadingDealpos(true);
        try {
          const res = await fetch(`/api/dealpos?branch=${branch}`);
          if (res.ok) {
            const data = await res.json();
            const rawData = data.Data || data.data || [];
            // Remove duplicates
            const groups: any[] = [];
            const seen = new Set();
            for (const entry of rawData) {
              if (!seen.has(entry.OrderID)) {
                seen.add(entry.OrderID);
                groups.push(entry);
              }
            }
            setDealposOrders(groups);
          }
        } catch (e) {
          console.warn("Failed fetching dealpos orders for debrief", e);
        } finally {
          setIsLoadingDealpos(false);
        }
      };
      fetchOrders();
    }
  }, [isOpen, step, branch]);

  // Handle resuming from a previously frozen session nicely if they closed the window half-way
  useEffect(() => {
    if (isOpen) {
      if (isDebriefInProgress) {
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [isOpen, isDebriefInProgress]);

  if (!isOpen) return null;

  // Handle Step Navigation and operations
  const handleNextStep1 = async () => {
    // Transitioning from 1 to 2: Freeze operasional
    const nowStr = new Date().toISOString();
    await updateOperationalConfigInCloud(branch, {
      isDebriefInProgress: true,
      debriefFrozenAt: nowStr
    });
    setStep(2);
  };

  const handleNext = () => {
    if (step === 3) {
      if (unclearedManualTickets.length > 0) {
        alert(`Harap selesaikan rekonsiliasi untuk semua kartu manual (${unclearedManualTickets.length} tersisa) sebelum melanjutkan.`);
        return;
      }
    }
    if (step === 5) {
      if (unclearedAnomalies.length > 0) {
        alert(`Harap simpan alasan anomali untuk semua kartu (${unclearedAnomalies.length} tersisa) sebelum melanjutkan.`);
        return;
      }
    }
    if (step === 6) {
      if (unclearedReceipts.length > 0) {
        alert(`Harap simpan konfirmasi resi fisik untuk semua kartu (${unclearedReceipts.length} tersisa) sebelum melanjutkan.`);
        return;
      }
    }
    if (step < 8) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  // Step 3: Save reconciliation for a specific ticket
  const handleSaveReconcile = async (ticketId: string) => {
    const orderId = reconcileInputs[ticketId]?.trim();
    if (!orderId) return;

    const t = tickets.find(x => x.id === ticketId);
    if (!t) return;

    const currentFlags = t.flags || [];
    const updatedFlags = [...currentFlags];
    if (!updatedFlags.includes("TELAT_UPDATE_ANTRIAN" as any)) {
      updatedFlags.push("TELAT_UPDATE_ANTRIAN" as any);
    }

    await updateTicketInCloud(ticketId, {
      dealposOrderId: orderId,
      flags: updatedFlags
    });

    setReconcileSaved(prev => ({ ...prev, [ticketId]: true }));
  };

  // Step 4: Move waiting to Active & assign mechanic (TELAT_UPDATE_SERVICE)
  const handleSaveService = async (ticketId: string) => {
    const mech = selectedMechanics[ticketId];
    if (!mech) return;

    const t = tickets.find(x => x.id === ticketId);
    if (!t) return;

    const currentFlags = t.flags || [];
    const updatedFlags = [...currentFlags];
    if (!updatedFlags.includes("TELAT_UPDATE_SERVICE" as any)) {
      updatedFlags.push("TELAT_UPDATE_SERVICE" as any);
    }

    await updateTicketInCloud(ticketId, {
      status: "active",
      mechanic: mech,
      "timestamps.called": new Date().toISOString(),
      flags: updatedFlags
    });

    setServiceSaved(prev => ({ ...prev, [ticketId]: true }));
  };

  // Step 5: Save anomaly reasons (TELAT_UPDATE_SELESAI / TELAT_UPDATE_SERVICE)
  const handleSaveAnomaly = async (ticketId: string) => {
    const isTelat = anomalyTelatUpdate[ticketId];
    const userReason = anomalyReasons[ticketId]?.trim();
    
    if (!isTelat && !userReason) return;

    const t = tickets.find(x => x.id === ticketId);
    if (!t) return;

    const currentFlags = t.flags || [];
    const updatedFlags = [...currentFlags];

    const isLateStart = isLateAfternoonStart(t);
    const isTraditional = t.flags?.includes("ANOMALI_DURASI_SERVICE" as any);

    if (isTelat) {
      if (isLateStart) {
        if (!updatedFlags.includes("TELAT_UPDATE_SERVICE" as any)) {
          updatedFlags.push("TELAT_UPDATE_SERVICE" as any);
        }
      } else if (isTraditional) {
        if (!updatedFlags.includes("TELAT_UPDATE_SELESAI" as any)) {
          updatedFlags.push("TELAT_UPDATE_SELESAI" as any);
        }
      }
    }

    const savedReasonString = isTelat ? "Telat Update" : userReason;
    const finalNotes = t.notes 
      ? `${t.notes} | [Reason: ${savedReasonString}]` 
      : `[Reason: ${savedReasonString}]`;

    await updateTicketInCloud(ticketId, {
      notes: finalNotes,
      flags: updatedFlags
    });

    setAnomalySaved(prev => ({ ...prev, [ticketId]: true }));
  };

  // Step 6: Fizik checklist (RESI_HILANG)
  const handleSaveReceipt = async (ticketId: string) => {
    const isMissing = missingReceipts[ticketId];

    const t = tickets.find(x => x.id === ticketId);
    if (!t) return;

    const currentFlags = t.flags || [];
    const updatedFlags = [...currentFlags];
    
    if (isMissing) {
      if (!updatedFlags.includes("RESI_HILANG" as any)) {
        updatedFlags.push("RESI_HILANG" as any);
      }
    } else {
      const idx = updatedFlags.indexOf("RESI_HILANG" as any);
      if (idx !== -1) updatedFlags.splice(idx, 1);
    }

    await updateTicketInCloud(ticketId, {
      flags: updatedFlags
    });

    setReceiptSaved(prev => ({ ...prev, [ticketId]: true }));
  };

  // Step 7: Overtime submissions
  const handleStartOvertime = () => {
    setStep(8);
  };

  const handleFullyCloseStore = () => {
    setStep(8);
  };

  const handleFinalizeDebrief = async () => {
    try {
      if (hasOvertimeToday) {
        await updateOperationalConfigInCloud(branch, {
          isBengkelOpen: false,
          isOvertimeActive: true,
          isDebriefInProgress: false,
          debriefFrozenAt: null,
          overtimeTicketIds: selectedOvertimeTickets,
          overtimeStoppedAt: null
        });
      } else {
        await updateOperationalConfigInCloud(branch, {
          isBengkelOpen: false,
          isOvertimeActive: false,
          isDebriefInProgress: false,
          debriefFrozenAt: null,
          overtimeTicketIds: [],
          overtimeStoppedAt: null
        });
      }
    } catch (e) {
      console.warn("Failed to finalize operational debrief in cloud", e);
    } finally {
      onClose();
      setStep(1);
      setCopied(false);
    }
  };

  const handleCloseDebriefModal = () => {
    onClose();
    setStep(1);
    setCopied(false);
  };

  // Report Compilation
  const compileFinalReportText = () => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, "0");
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const y = today.getFullYear();
    const dateStr = `${d}/${m}/${y}`;

    const { startDate, endDate } = getMonthlyCutoffDates();
    const isWithinMonthlyCutoff = (tsString: string | null | undefined) => {
      if (!tsString) return false;
      const tDate = new Date(tsString);
      return tDate >= startDate && tDate <= endDate;
    };

    // Filter today's branch tickets
    const branchSpec = tickets.filter(t => t.branch === branch);

    // Filter with specific flags restricted to today's operations/activities to prevent accumulative across days
    const countAntrian = branchSpec.filter(t => 
      (t.flags?.includes("TELAT_UPDATE_ANTRIAN" as any) || t.flags?.includes("TELAT_UPDATE" as any)) && 
      isToday(t.timestamps.arrival)
    ).length;

    const monthlyAntrian = branchSpec.filter(t => 
      (t.flags?.includes("TELAT_UPDATE_ANTRIAN" as any) || t.flags?.includes("TELAT_UPDATE" as any)) && 
      isWithinMonthlyCutoff(t.timestamps.arrival)
    ).length;

    const countService = branchSpec.filter(t => 
      t.flags?.includes("TELAT_UPDATE_SERVICE" as any) && 
      (isToday(t.timestamps.called) || isToday(t.timestamps.arrival))
    ).length;

    const countSelesai = branchSpec.filter(t => 
      t.flags?.includes("TELAT_UPDATE_SELESAI" as any) && 
      (isToday(t.timestamps.ready))
    ).length;

    const countResiHilang = branchSpec.filter(t => 
      t.flags?.includes("RESI_HILANG" as any) && 
      (isToday(t.timestamps.ready) || (t.status === "ready" && isToday(t.timestamps.arrival)))
    ).length;

    const countFollowUp = branchSpec.filter(t => {
      if (t.status !== "taken" || !t.timestamps.taken) return false;
      if (isTicketExcludedFromFollowUp(t)) return false;
      const takenTime = new Date(t.timestamps.taken).getTime();
      const daysSinceTaken = (Date.now() - takenTime) / (1000 * 3600 * 24);
      return daysSinceTaken >= 8;
    }).length;

    const monthlyFollowUp = branchSpec.filter(t => {
      if (t.status === "done") {
        const isFinishedThisMonth = t.timestamps?.finished && isWithinMonthlyCutoff(t.timestamps.finished);
        const isLate = t.flags?.some(f2 => (f2 as any) === "TELAT_FOLLOW_UP" || (f2 as any) === "LATE_FOLLOW_UP");
        return isFinishedThisMonth && isLate;
      } else if (t.status === "taken") {
        if (!t.timestamps.taken) return false;
        if (isTicketExcludedFromFollowUp(t)) return false;
        const takenTime = new Date(t.timestamps.taken).getTime();
        const daysSinceTaken = (Date.now() - takenTime) / (1000 * 3600 * 24);
        return daysSinceTaken >= 8;
      }
      return false;
    }).length;

    // Active
    const active = branchSpec.filter(t => t.status === "active");
    // Waiting
    const waiting = branchSpec.filter(t => t.status === "waiting");
    // Ready
    const ready = branchSpec.filter(t => t.status === "ready");

    // Helper formatting function
    const ticketFormat = (t: Ticket) => {
      const svcs = t.serviceTypes.join(", ");
      const num = t.ticketNumber ? `#${t.ticketNumber}` : `${t.id}`;
      const elapsed = calculateTicketDuration(t, isBengkelOpen, isOvertimeActive, isDebriefInProgress, debriefFrozenAt, overtimeTicketIds, overtimeStoppedAt);
      return `- [${num}] ${t.customerName.toUpperCase()} - ${t.unitSepeda.toUpperCase()} - (${svcs.toUpperCase()}) - ${elapsed}`;
    };

    // Gather all branch mechanics from configuration, supplemented by any historically assigned to today's active tickets.
    const allMechanicNames = new Set<string>();
    mechanics.forEach(m => {
      if (m && m.name) allMechanicNames.add(m.name.trim().toUpperCase());
    });
    branchSpec.forEach(t => {
      if (t.mechanic) allMechanicNames.add(t.mechanic.trim().toUpperCase());
      if (t.overtimeMechanic) allMechanicNames.add(t.overtimeMechanic.trim().toUpperCase());
    });

    let mechanicSection = "";
    Array.from(allMechanicNames).sort().forEach(picName => {
      const picCountService = branchSpec.filter(t => 
        (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName) && 
        t.flags?.includes("TELAT_UPDATE_SERVICE" as any) && 
        (isToday(t.timestamps.called) || isToday(t.timestamps.arrival))
      ).length;

      const monthlyPicCountService = branchSpec.filter(t => 
        (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName) && 
        t.flags?.includes("TELAT_UPDATE_SERVICE" as any) && 
        (isWithinMonthlyCutoff(t.timestamps.called) || isWithinMonthlyCutoff(t.timestamps.arrival))
      ).length;

      const picCountSelesai = branchSpec.filter(t => 
        (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName) && 
        t.flags?.includes("TELAT_UPDATE_SELESAI" as any) && 
        (isToday(t.timestamps.ready))
      ).length;

      const monthlyPicCountSelesai = branchSpec.filter(t => 
        (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName) && 
        t.flags?.includes("TELAT_UPDATE_SELESAI" as any) && 
        isWithinMonthlyCutoff(t.timestamps.ready)
      ).length;

      const picCountResiHilang = branchSpec.filter(t => 
        (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName) && 
        t.flags?.includes("RESI_HILANG" as any) && 
        (isToday(t.timestamps.ready) || (t.status === "ready" && isToday(t.timestamps.arrival)))
      ).length;

      const monthlyPicCountResiHilang = branchSpec.filter(t => 
        (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName) && 
        t.flags?.includes("RESI_HILANG" as any) && 
        (isWithinMonthlyCutoff(t.timestamps.ready) || (t.status === "ready" && isWithinMonthlyCutoff(t.timestamps.arrival)))
      ).length;

      const hasActiveCard = branchSpec.some(t => {
        const isPIC = (t.mechanic?.trim().toUpperCase() === picName || t.overtimeMechanic?.trim().toUpperCase() === picName);
        const isActiveState = (t.status === "waiting" || t.status === "active" || t.status === "pending" || t.status === "ready");
        return isPIC && isActiveState;
      });

      const hasIndicators = picCountService > 0 || picCountSelesai > 0 || picCountResiHilang > 0;

      if (hasActiveCard || hasIndicators) {
        mechanicSection += `\n*MECHANIC - ${picName}*\n`;
        mechanicSection += `- Telat Update Service: ${picCountService} Unit (Bulan ini: ${monthlyPicCountService} Unit)\n`;
        mechanicSection += `- Telat Update Selesai: ${picCountSelesai} Unit (Bulan ini: ${monthlyPicCountSelesai} Unit)\n`;
        mechanicSection += `- Resi Hilang: ${picCountResiHilang} Unit (Bulan ini: ${monthlyPicCountResiHilang} Unit)\n`;
      }
    });

    // Format Overtime Section if active
    let overtimeSection = "";
    if (hasOvertimeToday && selectedOvertimeTickets.length > 0) {
      overtimeSection += `*OVERTIME (LEMBUR)*\n\n`;
      const selectedTickets = tickets.filter(t => selectedOvertimeTickets.includes(t.id));
      const ticketsByPic: { [mechName: string]: Ticket[] } = {};
      selectedTickets.forEach(t => {
        const pic = (t.mechanic || t.overtimeMechanic || "TIDAK ADA PIC").trim().toUpperCase();
        if (!ticketsByPic[pic]) {
          ticketsByPic[pic] = [];
        }
        ticketsByPic[pic].push(t);
      });

      Object.keys(ticketsByPic).sort().forEach(picName => {
        overtimeSection += `*[${picName}]*\n`;
        ticketsByPic[picName].forEach(t => {
          overtimeSection += `${ticketFormat(t)}\n`;
        });
        overtimeSection += `\n`;
      });
    }

    let report = `*LAPORAN BENGKEL DAILY BIKE*\n_Tanggal: ${dateStr}_\n\n`;
    report += `*HASIL DEBRIEFING:*\n`;
    report += `*ADMIN*\n`;
    report += `- Telat Update Antrian : ${countAntrian} Unit (Bulan ini: ${monthlyAntrian} Unit)\n`;
    report += `- Telat Follow Up: ${countFollowUp} Unit (Bulan ini: ${monthlyFollowUp} Unit)\n`;
    if (mechanicSection) {
      report += mechanicSection;
    }
    report += `\n`;

    if (overtimeSection) {
      report += overtimeSection;
    } else {
      report += `\n`;
    }

    report += `*SEDANG DIKERJAKAN:*\n`;
    if (active.length > 0) {
      active.forEach(t => { report += `${ticketFormat(t)}\n`; });
    } else {
      report += `- TIDAK ADA ANTRIAN\n`;
    }
    report += `\n`;

    report += `*ANTRIAN MENUNGGU:*\n`;
    if (waiting.length > 0) {
      waiting.forEach(t => { report += `${ticketFormat(t)}\n`; });
    } else {
      report += `- TIDAK ADA ANTRIAN\n`;
    }
    report += `\n`;

    report += `*SIAP DIAMBIL:*\n`;
    if (ready.length > 0) {
      ready.forEach(t => { report += `${ticketFormat(t)}\n`; });
    } else {
      report += `- TIDAK ADA ANTRIAN\n`;
    }
    report += `\n`;

    report += `*FOLLOW UP:*\n`;
    const followUpTickets = branchSpec.filter(t => {
      if (t.status !== "taken" || !t.timestamps.taken) return false;
      if (isTicketExcludedFromFollowUp(t)) return false;
      const takenTime = new Date(t.timestamps.taken).getTime();
      const daysSinceTaken = (Date.now() - takenTime) / (1000 * 3600 * 24);
      return daysSinceTaken >= 3;
    });
    if (followUpTickets.length > 0) {
      followUpTickets.forEach(t => {
        report += `${ticketFormat(t)}\n`;
      });
    } else {
      report += `- TIDAK ADA DATA\n`;
    }

    return report;
  };

  const isGaransiTicket = (t: Ticket) => {
    const hasGaransiNote = t.notes && t.notes.includes('[GARANSI]');
    const hasGaransiService = t.serviceTypes && t.serviceTypes.some(s => s.trim().toUpperCase() === 'GARANSI');
    return !!(hasGaransiNote || hasGaransiService);
  };

  const isBerhasilTicket = (t: Ticket) => {
    if (isGaransiTicket(t)) return false;
    const res = t.followUpResult ? t.followUpResult.trim() : "";
    return res === 'Selesai' || res === 'Berhasil' || res === 'Tidak Respond' || res === 'Milik Internal';
  };

  const isBermasalahTicket = (t: Ticket) => {
    if (isGaransiTicket(t)) return false;
    return t.followUpResult?.trim() === 'Kendala';
  };

  const getMonthlyCutoffDates = (d?: Date) => {
    const date = d || new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();

    let startYear = year;
    let startMonth = month;
    let endYear = year;
    let endMonth = month;

    if (day >= 29) {
      // Current cycle started on 29th of this month and ends on 28th of next month
      startYear = year;
      startMonth = month;
      endMonth = month + 1;
      if (endMonth > 11) {
        endMonth = 0;
        endYear = year + 1;
      }
    } else {
      // Current cycle started on 29th of previous month and ends on 28th of this month
      endYear = year;
      endMonth = month;
      startMonth = month - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear = year - 1;
      }
    }

    const startDate = new Date(startYear, startMonth, 29, 0, 0, 0, 0);
    const endDate = new Date(endYear, endMonth, 28, 23, 59, 59, 999);

    return { startDate, endDate };
  };

  const compileMonthlyReportText = () => {
    const today = new Date();
    const monthNamesIndonesian = [
      "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
      "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
    ];
    const currentMonthName = monthNamesIndonesian[today.getMonth()];
    const currentYear = today.getFullYear();

    const { startDate, endDate } = getMonthlyCutoffDates();

    const branchSpec = tickets.filter(t => t.branch === branch);

    const cutoffTickets = branchSpec.filter(t => {
      if (t.status !== "done") return false;
      if (!t.followUpResult || t.followUpResult.trim() === "") return false;
      
      const tFinished = t.timestamps?.finished ? new Date(t.timestamps.finished) : null;
      if (!tFinished) return false;
      return tFinished >= startDate && tFinished <= endDate;
    });

    const totalServiceSelesai = cutoffTickets.filter(t => !isGaransiTicket(t)).length;
    const berhasilCount = cutoffTickets.filter(t => isBerhasilTicket(t)).length;
    const bermasalahCount = cutoffTickets.filter(t => isBermasalahTicket(t)).length;

    const adminTelatUpdateAntrian = cutoffTickets.filter(t => 
      t.flags?.some(f2 => (f2 as any) === "TELAT_UPDATE_ANTRIAN" || (f2 as any) === "TELAT_UPDATE")
    ).length;

    const adminTelatFollowUp = cutoffTickets.filter(t => 
      t.flags?.some(f2 => (f2 as any) === "TELAT_FOLLOW_UP" || (f2 as any) === "LATE_FOLLOW_UP")
    ).length;

    const activeMechanicNames = new Set<string>();
    cutoffTickets.forEach(t => {
      if (t.mechanic) activeMechanicNames.add(t.mechanic.trim().toUpperCase());
      if (t.overtimeMechanic) activeMechanicNames.add(t.overtimeMechanic.trim().toUpperCase());
    });

    const sortedMechanicsObj = Array.from(activeMechanicNames).sort();

    let mechanicScoresStr = "";
    sortedMechanicsObj.forEach(mName => {
      const picTelatUpdateService = cutoffTickets.filter(t => {
        const isPIC = (t.mechanic?.trim().toUpperCase() === mName) || (t.overtimeMechanic?.trim().toUpperCase() === mName);
        return isPIC && t.flags?.includes("TELAT_UPDATE_SERVICE" as any);
      }).length;

      const picTelatUpdateSelesai = cutoffTickets.filter(t => {
        const isPIC = (t.mechanic?.trim().toUpperCase() === mName) || (t.overtimeMechanic?.trim().toUpperCase() === mName);
        return isPIC && t.flags?.includes("TELAT_UPDATE_SELESAI" as any);
      }).length;

      const picResiHilang = cutoffTickets.filter(t => {
        const isPIC = (t.mechanic?.trim().toUpperCase() === mName) || (t.overtimeMechanic?.trim().toUpperCase() === mName);
        return isPIC && t.flags?.includes("RESI_HILANG" as any);
      }).length;

      mechanicScoresStr += `*MEKANIK_PIC_${mName}*\n`;
      mechanicScoresStr += `- Telat Update Service: ${picTelatUpdateService} Unit\n`;
      mechanicScoresStr += `- Telat Update Selesai: ${picTelatUpdateSelesai} Unit\n`;
      mechanicScoresStr += `- Resi Hilang: ${picResiHilang} Unit\n\n`;
    });

    let report = `*REKAP BULANAN: ${currentMonthName} ${currentYear}*\n\n`;
    report += `*1. PERFORMA SERVIS*\n`;
    report += `- Total Service Selesai: ${totalServiceSelesai} Unit\n`;
    report += `- Selesai: ${berhasilCount} Unit\n`;
    report += `- Bermasalah: ${bermasalahCount} Unit\n\n`;

    report += `*2. PERFORMA TIM*\n`;
    report += `*ADMIN*\n`;
    report += `- Telat Update Antrian : ${adminTelatUpdateAntrian} Unit\n`;
    report += `- Telat Follow Up: ${adminTelatFollowUp} Unit\n\n`;

    if (mechanicScoresStr) {
      report += mechanicScoresStr.trimEnd();
    } else {
      report += `(Tidak ada mekanik aktif dalam periode rekap ini)\n`;
    }

    return report;
  };

  const copyToClipboard = () => {
    const text = compileFinalReportText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyMonthlyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(compileMonthlyReportText());
      setMonthlyCopied(true);
      setTimeout(() => setMonthlyCopied(false), 2500);
    } catch (err) {
      console.error("Gagal menyalin rekap bulanan:", err);
    }
  };

  // Filter dealpos orders by search
  const filteredDealpos = dealposOrders.filter(o => 
    o.Number?.toLowerCase().includes(dealposSearchTerm.toLowerCase()) ||
    o.Customer?.toLowerCase().includes(dealposSearchTerm.toLowerCase()) ||
    o.ParkLabel?.toLowerCase().includes(dealposSearchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col font-sans">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full uppercase tracking-widest">
                DEBRIEFING OPERASIONAL
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Branch: {branch === "pik" ? "PIK 2" : "Muara Karang"}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mt-1">
              Wizard Tutup Bengkel & Evaluasi
            </h3>
          </div>
          <button 
            onClick={handleCloseDebriefModal}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* STEPPER PROGRESS */}
        <div className="px-6 py-4 bg-slate-100/50 border-b border-slate-100 flex items-center justify-between gap-1 overflow-x-auto whitespace-nowrap">
          {(hasMonthlyRekap ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                step === s 
                  ? "bg-slate-900 text-white shadow-md ring-4 ring-slate-100 scale-105" 
                  : step > s 
                    ? "bg-emerald-500 text-white" 
                    : "bg-slate-200 text-slate-500"
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < (hasMonthlyRekap ? 9 : 8) && <div className={`w-4 sm:w-8 h-0.5 ${step > s ? "bg-emerald-400" : "bg-slate-200"}`}></div>}
            </div>
          ))}
        </div>

        {/* COMPONENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* STEP 1: GATHERING */}
          {step === 1 && (
            <div className="space-y-6 text-center max-w-lg mx-auto py-12">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 border border-blue-200 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Users size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Kumpulkan Semua Staff Bengkel</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Harap kumpulkan seluruh **Mekanik** dan **Admin** di area meja depan untuk memulai evaluasi, pengecekan, serta debriefing operasional harian.
                </p>
              </div>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-left">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs font-semibold text-amber-800 leading-relaxed">
                  <p className="font-extrabold uppercase mb-1">PEMBERITAHUAN UTAMA</p>
                  Mengklik tombol <strong className="font-black">"Mulai Freeze (Selanjutnya)"</strong> di bawah akan **membekukan seluruh asupan pendaftaran baru (no intake)**, menghentikan live tracker waktu pengerjaan serta menutup akses ubah status dari sisi mekanik.
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleNextStep1}
                  className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md"
                >
                  Mulai Freeze (Selanjutnya)
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REASSURANCE OF FREEZING */}
          {step === 2 && (
            <div className="space-y-6 text-center max-w-lg mx-auto py-12">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 border border-rose-200 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Ban size={28} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Bengkel Berhasil Bekukan (Frozen)</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Seluruh pembaruan di lapangan telah dihentikan (freeze mode) demi proses rekonsiliasi yang valid.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1">
                  <span className="text-[9px] bg-rose-100 text-rose-700 font-extrabold px-2 py-0.5 rounded tracking-wide uppercase">FREEZE CLOCK</span>
                  <p className="text-xs font-bold text-slate-700">Waktu berjalan untuk tiket "Sedang Dikerjakan" dan "Tertunda" dihentikan harian.</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1">
                  <span className="text-[9px] bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded tracking-wide uppercase">LOCKED ACTIONS</span>
                  <p className="text-xs font-bold text-slate-700">Mekanik dilarang memperbarui status antrian. Seluruh tombol pembaruan terkunci.</p>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={handleNext}
                  className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-wider transition-all"
                >
                  Selanjutnya (Cek Antrian Manual)
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RECONCILE MANUAL CARDS */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-2xl">
                <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
                  <Link size={16} /> 1. Rekonsiliasi Kartu Antrian Manual
                </h4>
                <p className="text-xs text-blue-700 mt-1 font-semibold leading-relaxed">
                  Harap hubungkan semua kartu antrian virtual manual dengan kode tagihan/OrderID parkir di DealPOS. Jika belum memiliki, input OrderID/Invoice parkir secara manual untuk mencegah data loss.
                </p>
              </div>

              {manualTickets.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckSquare className="text-emerald-500 mx-auto animate-bounce" size={32} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Tidak ada kartu antrian manual yang tersisa!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {manualTickets.map(ticket => (
                    <div key={ticket.id} className="p-5 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row justify-between items-start gap-5 bg-white shadow-sm hover:shadow transition-shadow">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded uppercase">
                            #{ticket.ticketNumber || "NO-NUM"}
                          </span>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            {ticket.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          Model: {ticket.unitSepeda} — Servis: {ticket.serviceTypes.join(", ")}
                        </p>
                      </div>

                      <div className="w-full md:w-96 flex flex-col gap-4 border-t pt-4 md:border-t-0 md:pt-0 md:pl-5 md:border-l border-slate-150 shrink-0">
                        {reconcileSaved[ticket.id] ? (
                          <div className="flex items-center justify-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-3 rounded-xl text-xs font-black uppercase border border-emerald-200">
                            <Check size={16} /> Tersimpan ({reconcileInputs[ticket.id]})
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Option 1: Search & Choose from open Parked Orders */}
                            <div className="space-y-1.5 relative">
                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Opsi A: Cari & Pilih Tagihan Terbuka (Parked Order)</span>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  placeholder="Ketik nama / no. order atau klik dropdown..."
                                  className="w-full p-2.5 pr-14 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-800 placeholder-slate-400"
                                  value={step3Searches[ticket.id] || ""}
                                  onChange={(e) => {
                                    setStep3Searches(prev => ({ ...prev, [ticket.id]: e.target.value }));
                                    setStep3DropdownOpen(prev => ({ ...prev, [ticket.id]: true }));
                                  }}
                                  onFocus={() => {
                                    setStep3DropdownOpen(prev => ({ ...prev, [ticket.id]: true }));
                                  }}
                                />
                                <div className="absolute right-2 flex items-center gap-1.5 z-10">
                                  {step3Searches[ticket.id] && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStep3Searches(prev => ({ ...prev, [ticket.id]: "" }));
                                        setReconcileInputs(prev => ({ ...prev, [ticket.id]: "" }));
                                        setStep3DropdownOpen(prev => ({ ...prev, [ticket.id]: true }));
                                      }}
                                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                      Clear
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStep3DropdownOpen(prev => ({ ...prev, [ticket.id]: !prev[ticket.id] }));
                                    }}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                </div>
                              </div>
                              
                              {/* List filtered results if dropdown is open */}
                              {step3DropdownOpen[ticket.id] && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setStep3DropdownOpen(prev => ({ ...prev, [ticket.id]: false }))}
                                  />
                                  <div className="absolute left-0 right-0 z-50 max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg divide-y divide-slate-100 mt-1">
                                    {(() => {
                                      const rawQ = step3Searches[ticket.id] || "";
                                      const isPreSelected = rawQ.startsWith("#");
                                      const q = isPreSelected ? "" : rawQ.toLowerCase().trim();
                                      
                                      const matches = dealposOrders.filter(o => 
                                        !q ||
                                        (o.Number || "").toLowerCase().includes(q) ||
                                        (o.Customer || "").toLowerCase().includes(q) ||
                                        (o.ParkLabel || "").toLowerCase().includes(q)
                                      );
                                      
                                      if (matches.length === 0) {
                                        return <div className="p-3 text-[11px] font-bold text-slate-400 uppercase text-center">Tidak ada kecocokan</div>;
                                      }
                                      return matches.map(o => (
                                        <button
                                          key={o.OrderID}
                                          type="button"
                                          onClick={() => {
                                            setReconcileInputs(prev => ({ ...prev, [ticket.id]: o.OrderID }));
                                            setStep3Searches(prev => ({ ...prev, [ticket.id]: `#${o.Number} - ${o.Customer || o.ParkLabel || "No Name"}` }));
                                            setStep3DropdownOpen(prev => ({ ...prev, [ticket.id]: false }));
                                          }}
                                          className="w-full p-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex justify-between items-center"
                                        >
                                          <span>#{o.Number} - {o.Customer || o.ParkLabel || "No Name"}</span>
                                          <span className="text-[9px] font-black uppercase text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Pilih</span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Option 2: Search finalized invoice by number */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Opsi B: Cari No. Invoice (Final/Paid Backup)</span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="No. Invoice (misal: 26.05.00347)..."
                                  className="flex-1 p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-800 placeholder-slate-400"
                                  value={step3ManualInvoice[ticket.id] || ""}
                                  onChange={(e) => setStep3ManualInvoice(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  onClick={() => searchInvoiceForTicket(ticket.id)}
                                  disabled={!step3ManualInvoice[ticket.id]?.trim() || step3InvoiceSearchResult[ticket.id]?.loading}
                                  className="px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 shrink-0"
                                >
                                  {step3InvoiceSearchResult[ticket.id]?.loading ? "..." : "Cari"}
                                </button>
                              </div>

                              {/* Search results display */}
                              {step3InvoiceSearchResult[ticket.id] && (
                                <div className="text-[11px] font-bold p-2.5 rounded-xl border mt-1">
                                  {step3InvoiceSearchResult[ticket.id].loading && (
                                    <div className="text-slate-500 animate-pulse uppercase">🔍 SEDANG MENCARI INVOICE...</div>
                                  )}
                                  {step3InvoiceSearchResult[ticket.id].error && (
                                    <div className="text-rose-600 uppercase">❌ {step3InvoiceSearchResult[ticket.id].error}</div>
                                  )}
                                  {step3InvoiceSearchResult[ticket.id].found && (
                                    <div className="text-emerald-600 uppercase flex flex-col gap-0.5">
                                      <span className="font-black">✅ INVOICE DITEMUKAN:</span>
                                      <span className="text-slate-800 font-bold">No: #{step3InvoiceSearchResult[ticket.id].Number}</span>
                                      <span className="text-slate-800 font-bold">Nama: {step3InvoiceSearchResult[ticket.id].CustomerName.toUpperCase()}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions / Confirmation */}
                            {reconcileInputs[ticket.id] && (
                              <div className="pt-2 flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                                <div className="text-[10px] font-black text-slate-600 uppercase truncate">
                                  ID: <span className="font-mono text-blue-600">{reconcileInputs[ticket.id]}</span>
                                </div>
                                <button
                                  onClick={() => handleSaveReconcile(ticket.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shrink-0 active:scale-95"
                                >
                                  Hubungkan Kartu
                                </button>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unclearedManualTickets.length > 0 && (
                <div className="bg-amber-50 border border-amber-250 p-3.5 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs font-black uppercase tracking-wider">
                  <AlertCircle size={16} className="text-amber-600 animate-pulse" />
                  <span>Sisa {unclearedManualTickets.length} Kartu Manual Belum Direkonsiliasi</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Kembali
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow"
                >
                  Selanjutnya <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW TICKETS IN waiting ZONE */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <h4 className="text-sm font-black text-amber-950 uppercase tracking-tight flex items-center gap-2">
                  <Clock size={16} /> 2. Review Antrian "Menunggu"
                </h4>
                <p className="text-xs text-amber-800 mt-1 font-semibold leading-relaxed">
                  Apakah di lapangan ada antrian yang sudah dikerjakan mekanik namun admin lupa memindahkannya ke kolom "Dikerjakan"? Isilah mekanik PIC dan pindahkan ke dikerjakan sekarang. (Semua perubahan di sini otomatis bertagar <strong className="font-bold">TELAT_UPDATE_SERVICE</strong>).
                </p>
              </div>

              {waitingTickets.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckSquare className="text-emerald-500 mx-auto" size={32} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Kolom Menunggu Bersih!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {waitingTickets.map(ticket => (
                    <div key={ticket.id} className="p-4 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-sm hover:shadow transition-shadow">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase">
                            #{ticket.ticketNumber || "NO-NUM"}
                          </span>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            {ticket.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          Model: {ticket.unitSepeda} — Servis: {ticket.serviceTypes.join(", ")}
                        </p>
                      </div>

                      <div className="w-full md:w-auto flex items-center gap-2 shrink-0">
                        {serviceSaved[ticket.id] ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl text-xs font-black uppercase">
                            <Check size={16} /> Dikerjakan PIC
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <select
                              className="p-2 border border-slate-200 rounded-lg outline-none text-xs bg-slate-50 font-bold text-slate-700 w-44"
                              value={selectedMechanics[ticket.id] || ""}
                              onChange={(e) => setSelectedMechanics(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            >
                              <option value="">Pilih Mekanik PIC...</option>
                              {mechanics.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleSaveService(ticket.id)}
                              disabled={!selectedMechanics[ticket.id]}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0"
                            >
                              Mulai Kerja
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Kembali
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow"
                >
                  Selanjutnya <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW ANOMALY TIMES */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                <h4 className="text-sm font-black text-red-950 uppercase tracking-tight flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-700 animate-pulse" /> 3. Review Anomali &amp; Pemindahan Sore (Selesai &lt; 5 Menit / Lewat 16:45)
                </h4>
                <p className="text-xs text-red-700 mt-1 font-semibold leading-relaxed">
                  Ditemukan kartu antrian dengan durasi di bawah 5 menit, ATAU kartu yang baru dipindahkan dari Menunggu ke Dikerjakan sore hari (lewat pukul 16:45). Hubungi admin/mekanik untuk menanyakan alasan, atau centang opsi "Telat Update" (otomatis bertagar <strong className="font-bold">TELAT_UPDATE_SELESAI</strong> atau <strong className="font-bold">TELAT_UPDATE_SERVICE</strong>).
                </p>
              </div>

              {anomalyTickets.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckSquare className="text-emerald-500 mx-auto" size={32} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Tidak ada kartu anomali durasi atau pemindahan sore harian!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomalyTickets.map(ticket => {
                    const isLateStart = isLateAfternoonStart(ticket);
                    const isTraditional = ticket.flags?.includes("ANOMALI_DURASI_SERVICE" as any);
                    
                    let badgeLabel = "ANOMALI 5 MENIT";
                    let badgeColor = "bg-red-50 text-red-700 border-red-200";
                    if (isLateStart && isTraditional) {
                      badgeLabel = "ANOMALI GANDA (5M & SORE)";
                      badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
                    } else if (isLateStart) {
                      badgeLabel = "PEMINDAHAN SORE (>= 16:45)";
                      badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                    }

                    const placeholderText = isLateStart 
                      ? "Tuliskan alasan baru dikerjakan sore..." 
                      : "Tuliskan alasan durasi singkat...";

                    const isSavedSaved = anomalySaved[ticket.id] || 
                      ticket.flags?.includes("TELAT_UPDATE_SELESAI" as any) || 
                      ticket.flags?.includes("TELAT_UPDATE_SERVICE" as any) || 
                      ticket.notes?.includes("[Reason:");

                    return (
                      <div key={ticket.id} className="p-4 border border-slate-200/80 rounded-2xl flex flex-col justify-between gap-3 bg-white shadow-sm hover:shadow transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded uppercase">
                                #{ticket.ticketNumber || "NO-NUM"}
                              </span>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                {ticket.customerName}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold mt-1">
                              Model: {ticket.unitSepeda} — Servis: {ticket.serviceTypes.join(", ")} — PIC: {ticket.mechanic || "Belum ada"}
                            </p>
                            {isLateStart && ticket.timestamps?.called && (
                              <p className="text-[10px] text-amber-600 font-bold mt-0.5 uppercase tracking-tight">
                                Mulai Kerja: {new Date(ticket.timestamps.called).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                              </p>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-1 rounded font-black border uppercase tracking-tight ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60 mt-1">
                          {isSavedSaved ? (
                            <div className="flex flex-col w-full text-center items-center justify-center p-1">
                              <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl text-xs font-black uppercase w-full justify-center">
                                <Check size={16} /> Alasan Disimpan
                              </div>
                              {ticket.notes && ticket.notes.includes("[Reason:") && (
                                <p className="text-xs text-slate-500 font-bold mt-1.5">
                                  Alasan: {ticket.notes.split("[Reason:").pop()?.replace("]", "").trim()}
                                </p>
                              )}
                              {ticket.flags?.includes("TELAT_UPDATE_SELESAI" as any) && (
                                <p className="text-[10px] text-red-600 font-extrabold mt-1 uppercase">
                                  Tag Penalti: TELAT_UPDATE_SELESAI
                                </p>
                              )}
                              {ticket.flags?.includes("TELAT_UPDATE_SERVICE" as any) && (
                                <p className="text-[10px] text-amber-600 font-extrabold mt-1 uppercase">
                                  Tag Penalti: TELAT_UPDATE_SERVICE
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full justify-between">
                              <div className="flex-1 flex gap-2">
                                <input
                                  type="text"
                                  disabled={!!anomalyTelatUpdate[ticket.id]}
                                  placeholder={placeholderText}
                                  className="flex-1 p-2 text-xs border border-slate-200 rounded-lg outline-none bg-white font-semibold text-slate-800 disabled:opacity-55"
                                  value={anomalyReasons[ticket.id] || ""}
                                  onChange={(e) => setAnomalyReasons(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                />
                                <label className="flex items-center gap-1 shrink-0 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-slate-800 rounded border-slate-300"
                                    checked={!!anomalyTelatUpdate[ticket.id]}
                                    onChange={(e) => {
                                      setAnomalyTelatUpdate(prev => ({ ...prev, [ticket.id]: e.target.checked }));
                                      if (e.target.checked) {
                                        setAnomalyReasons(prev => ({ ...prev, [ticket.id]: "" }));
                                      }
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-700 uppercase">Telat Update</span>
                                </label>
                              </div>
                              <button
                                onClick={() => handleSaveAnomaly(ticket.id)}
                                disabled={!anomalyTelatUpdate[ticket.id] && !anomalyReasons[ticket.id]}
                                className="bg-slate-900 hover:bg-black disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0"
                              >
                                Simpan Alasan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {unclearedAnomalies.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs font-black uppercase tracking-wider">
                  <AlertCircle size={16} className="text-rose-600 animate-pulse" />
                  <span>Sisa {unclearedAnomalies.length} Alasan Anomali Belum Disimpan</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Kembali
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow"
                >
                  Selanjutnya <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: CHECK SIAP DIAMBIL (RESI_HILANG) */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <h4 className="text-sm font-black text-emerald-950 uppercase tracking-tight flex items-center gap-2">
                  <CheckSquare size={16} /> 4. Konfirmasi Resi Fisik "Siap Diambil"
                </h4>
                <p className="text-xs text-emerald-800 mt-1 font-semibold leading-relaxed">
                  Harap verifikasi apakah lembaran resi fisik kelengkapan masih tergantung rapi pada sepedah di area "Siap Diambil". Centang opsi di bawah jika **resi fisik hilang** (otomatis bertagar <strong className="font-bold">RESI_HILANG</strong>).
                </p>
              </div>

              {readyTickets.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckSquare className="text-emerald-500 mx-auto" size={32} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Tidak ada sepeda di kolom Siap Diambil harian!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {readyTickets.map(ticket => {
                    const isHilangDefault = ticket.flags?.includes("RESI_HILANG" as any);
                    return (
                      <div key={ticket.id} className="p-4 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-sm hover:shadow transition-shadow">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">
                              #{ticket.ticketNumber || "NO-NUM"}
                            </span>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                              {ticket.customerName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-bold mt-1">
                            Model: {ticket.unitSepeda} — Servis: {ticket.serviceTypes.join(", ")}
                          </p>
                        </div>

                        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                          {receiptSaved[ticket.id] ? (
                            <div className="flex items-center justify-center gap-1.5 text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl text-xs font-black uppercase border border-emerald-200">
                              <Check size={16} /> Tersimpan ({(missingReceipts[ticket.id] !== undefined ? missingReceipts[ticket.id] : isHilangDefault) ? "RESI FISIK HILANG" : "RESI ADA"})
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setMissingReceipts(prev => ({ ...prev, [ticket.id]: false }))}
                                  className={`px-3 py-2.5 text-xs font-black rounded-xl uppercase flex items-center justify-center gap-1 border transition-all ${
                                    (missingReceipts[ticket.id] === false || (missingReceipts[ticket.id] === undefined && !isHilangDefault))
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-black shadow-sm"
                                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  <span>✅ Resi Ada</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMissingReceipts(prev => ({ ...prev, [ticket.id]: true }))}
                                  className={`px-3 py-2.5 text-xs font-black rounded-xl uppercase flex items-center justify-center gap-1 border transition-all ${
                                    (missingReceipts[ticket.id] === true || (missingReceipts[ticket.id] === undefined && isHilangDefault))
                                      ? "bg-rose-50 text-rose-700 border-rose-300 font-black shadow-sm"
                                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  <span>❌ Resi Fisik Hilang</span>
                                </button>
                              </div>

                              <button
                                onClick={() => handleSaveReceipt(ticket.id)}
                                className="bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow shrink-0 active:scale-95"
                              >
                                Simpan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {unclearedReceipts.length > 0 && (
                <div className="bg-amber-50 border border-amber-250 p-3.5 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs font-black uppercase tracking-wider">
                  <AlertCircle size={16} className="text-amber-600 animate-pulse" />
                  <span>Sisa {unclearedReceipts.length} Konfirmasi Resi Belum Disimpan</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Kembali
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow"
                >
                  Selanjutnya <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: OVERTIME TRIGGERS */}
          {step === 7 && (
            <div className="space-y-6 text-center max-w-2xl mx-auto py-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 border border-amber-200 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Clock size={28} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Setel Jadwal Overtime (Lembur)</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Apakah bengkel akan melanjutkan proses perbaikan lembur malam hari ini? Silakan pilih opsi operasional.
                </p>
              </div>

              {hasOvertimeToday === null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 max-w-md mx-auto">
                  <button
                    disabled={eligibleOvertimeTickets.length === 0}
                    onClick={() => setHasOvertimeToday(true)}
                    className={`p-6 border-2 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group ${
                      eligibleOvertimeTickets.length === 0
                        ? "border-slate-100 bg-slate-50/50 text-slate-350 cursor-not-allowed"
                        : "border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-slate-700 hover:text-amber-900 active:scale-95"
                    }`}
                  >
                    <span className="text-3xl opacity-80">⚡</span>
                    <strong className="text-sm font-black uppercase tracking-wide">Ya, Ada Overtime</strong>
                    {eligibleOvertimeTickets.length === 0 && (
                      <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider mt-0.5">
                        (Tidak Ada Antrian Aktif)
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setHasOvertimeToday(false);
                      handleFullyCloseStore();
                    }}
                    className="p-6 border-2 border-slate-200 hover:border-slate-800 hover:bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-700 hover:text-slate-900 transition-all active:scale-95 group"
                  >
                    <span className="text-3xl">🔒</span>
                    <strong className="text-sm font-black uppercase tracking-wide">Tidak Ada Overtime</strong>
                  </button>
                </div>
              ) : hasOvertimeToday === true ? (
                <div className="space-y-6 text-left border-2 border-amber-100 rounded-3xl p-5 bg-amber-50/20">
                  <div>
                    <h5 className="text-sm font-black text-amber-900 uppercase">Pilih Antrian Yang Dikerjakan Saat Overtime</h5>
                    <p className="text-xs text-amber-700 leading-relaxed font-semibold mt-1">
                      Mekanik dan admin hanya dapat memproses antrian tertunda/lembur yang bersumber dari kolom "Menunggu" dan "Dikerjakan" saja. Jam pengerjaan (Dikerjakan) hanya akan aktif/ticking khusus untuk antrian lembur yang tercentang di bawah saat mode overtime aktif.
                    </p>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-2xl p-3 bg-white">
                    {tickets.filter(t => t.status === "waiting" || t.status === "active" || t.status === "pending").length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold uppercase text-center py-4">Tidak ada antrian di kolom Menunggu, Dikerjakan, atau Tertunda.</p>
                    ) : (
                      tickets.filter(t => t.status === "waiting" || t.status === "active" || t.status === "pending").map(t => {
                        const isChecked = selectedOvertimeTickets.includes(t.id);
                        return (
                          <div key={t.id} className="flex flex-col gap-2 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/50">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="w-5 h-5 accent-slate-800 rounded border-slate-300"
                                checked={isChecked}
                                onChange={async (e) => {
                                  if (e.target.checked) {
                                    setSelectedOvertimeTickets(prev => [...prev, t.id]);
                                  } else {
                                    setSelectedOvertimeTickets(prev => prev.filter(x => x !== t.id));
                                    try {
                                      await updateTicketInCloud(t.id, { overtimeMechanic: null });
                                    } catch (err) {
                                      console.error("Failed to clear overtime mechanic:", err);
                                    }
                                  }
                                }}
                              />
                              <div className="text-xs font-extrabold text-slate-850 flex-1">
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded tracking-tight text-[10px] uppercase font-black">
                                  #{t.ticketNumber || "NO"}
                                </span>{" "}
                                {t.customerName.toUpperCase()} — {t.unitSepeda.toUpperCase()} ({t.status === "active" ? "SEDANG DIKERJAKAN" : t.status === "pending" ? "TERTUNDA" : "MENUNGGU"})
                              </div>
                            </label>
                            {isChecked && t.status === "waiting" && (
                              <div className="pl-8 flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-amber-700 whitespace-nowrap">Mekanik PIC:</span>
                                <select
                                  value={t.overtimeMechanic || ""}
                                  onChange={async (e) => {
                                    const val = e.target.value || null;
                                    try {
                                      await updateTicketInCloud(t.id, { overtimeMechanic: val });
                                    } catch (err) {
                                      console.error("Failed to set overtime mechanic PIC:", err);
                                    }
                                  }}
                                  className={`text-xs font-bold border rounded-lg px-2.5 py-1 text-slate-800 outline-none flex-1 max-w-xs bg-white ${
                                    !t.overtimeMechanic ? "border-rose-300 bg-rose-50/50" : "border-slate-200"
                                  }`}
                                >
                                  <option value="">-- Pilih Mekanik PIC --</option>
                                  {mechanics.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {selectedOvertimeTickets.length === 0 ? (
                    <p className="text-xs text-rose-600 font-extrabold uppercase animate-pulse">
                      ⚠️ Sesi Overtime harus memilih minimal 1 antrian yang akan dikerjakan.
                    </p>
                  ) : !isOvertimeSelectionValid ? (
                    <p className="text-xs text-rose-600 font-extrabold uppercase animate-pulse">
                      ⚠️ Harap pilih Mekanik PIC untuk semua antrian Menunggu yang dipilih untuk Overtime.
                    </p>
                  ) : null}

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setHasOvertimeToday(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Kembali Opsi
                    </button>
                    <button
                      onClick={handleStartOvertime}
                      disabled={!isOvertimeSelectionValid}
                      className={`px-5 py-2.5 border text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow ${
                        isOvertimeSelectionValid
                          ? "bg-amber-500 hover:bg-amber-600 border-amber-600"
                          : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed shadow-none"
                      }`}
                    >
                      Aktifkan Overtime
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-center border border-slate-200 rounded-3xl p-6 bg-slate-50/50">
                  <div className="text-3xl">🔒</div>
                  <div>
                    <h5 className="text-sm font-black text-slate-800 uppercase">Tidak Ada Overtime Hari Ini</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mt-1 font-semibold">
                      Anda memilih untuk menutup toko sepenuhnya tanpa pengerjaan lembur malam ini. Silakan klik tombol di bawah untuk melanjutkan ke pengisian laporan.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setHasOvertimeToday(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Ubah Pilihan
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(8)}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow"
                    >
                      Lanjut Laporan
                    </button>
                  </div>
                </div>
              )}

              {hasOvertimeToday === null && (
                <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                  <button
                    onClick={handlePrev}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                  >
                    <ChevronLeft size={16} /> Kembali
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 8: FINAL DAILY REPORT FORMATTED */}
          {step === 8 && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-emerald-950 uppercase tracking-tight flex items-center gap-2">
                    <FileText size={16} /> Kompilasi Laporan Harian Sukses
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 font-semibold leading-relaxed">
                    Evaluasi debrief selesai. Laporan performa WhatsApp siap dicopy ke grup management.
                  </p>
                </div>
                {hasOvertimeToday && (
                  <span className="bg-amber-500 text-white text-[9px] px-2.5 py-1 rounded-full font-black uppercase animate-pulse">
                    🔋 MODE OVERTIME DIPILIH
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Laporan WhatsApp Format</label>
                <textarea
                  readOnly
                  className="w-full text-xs font-bold leading-relaxed text-slate-800 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono h-80"
                  value={compileFinalReportText()}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow ${
                      copied 
                        ? "bg-emerald-600 text-white" 
                        : "bg-slate-900 text-white hover:bg-black"
                    }`}
                  >
                    <Clipboard size={16} /> {copied ? "Berhasil Di-copy!" : "Copy Laporan WA"}
                  </button>
                </div>

                <div className="flex gap-2">
                  {hasMonthlyRekap ? (
                    <button
                      onClick={() => setStep(9)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow transition-all active:scale-95 flex items-center gap-1"
                    >
                      Lanjut Rekap Bulanan <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinalizeDebrief}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow transition-all active:scale-95"
                    >
                      {hasOvertimeToday ? "🔋 MULAI OVERTIME & SELESAI" : "🔒 SELESAI & TUTUP TOKO"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: MONTHLY REPORT FORMATTED */}
          {step === 9 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-blue-955 uppercase tracking-tight flex items-center gap-2">
                    <FileText size={16} /> Kompilasi Rekap Bulanan Sukses
                  </h4>
                  <p className="text-xs text-blue-800 mt-1 font-semibold leading-relaxed">
                    Setiap tanggal 28, rekap bulanan performa servis dan tim digenerate untuk grup management.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Laporan Rekap Bulanan Format</label>
                <textarea
                  readOnly
                  className="w-full text-xs font-bold leading-relaxed text-slate-800 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono h-80"
                  value={compileMonthlyReportText()}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(8)}
                    className="px-4 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                  >
                    <ChevronLeft size={16} /> Kembali ke Harian
                  </button>
                  <button
                    onClick={copyMonthlyToClipboard}
                    className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow ${
                      monthlyCopied 
                        ? "bg-emerald-600 text-white" 
                        : "bg-slate-900 text-white hover:bg-black"
                    }`}
                  >
                    <Clipboard size={16} /> {monthlyCopied ? "Berhasil Di-copy!" : "Copy Rekap Bulanan"}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleFinalizeDebrief}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow transition-all active:scale-95"
                  >
                    {hasOvertimeToday ? "🔋 MULAI OVERTIME & SELESAI" : "🔒 SELESAI & TUTUP TOKO"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
