import React, { useState, useMemo } from "react";
import { debugFastForwardTaken, isTicketExcludedFromFollowUp } from "../services/ticketService";
import { DebriefModal, calculateTicketDuration } from "../components/DebriefModal";
import {
  Ticket,
  KpiData,
  MechanicDefinition,
  ServiceDefinition,
  Customer,
  flag_type,
} from "../types";
import TicketCard from "../components/TicketCard";
import {
  CreateTicketModal,
  AssignMechanicModal,
  PendingModal,
  CancelModal,
  EditServicesModal,
  KendalaModal,
  FollowUpModal,
} from "../components/Modals";
import {
  Plus,
  Users,
  Clock,
  PlayCircle,
  CheckCircle,
  PackageCheck,
  Ban,
  MessageSquare,
  AlertTriangle,
  MapPin,
} from "lucide-react";

interface DashboardProps {
  tickets: Ticket[];
  mechanics: MechanicDefinition[];
  services: ServiceDefinition[];
  customers: Customer[];
  addTicket: (
    name: string,
    phone: string,
    unit: string,
    svcs: string[],
    notes: string,
    customerId?: string,
    dealposOrderId?: string,
    flags?: flag_type[],
    serviceSkuCodes?: string[],
    dealposOrderNumber?: string,
  ) => void;
  updateTicketStatus: (
    id: string,
    status: any,
    mechanic?: string,
    notes?: string,
    reason?: string,
    followUpResult?: string,
    followUpPhotoUrl?: string
  ) => void;
  updateTicketServices: (
    id: string,
    serviceTypes: string[],
    notes?: string,
  ) => void;
  connectTicketToDealpos?: (
    id: string,
    dealposOrderId: string,
    customerName?: string,
    phone?: string,
    serviceSkuCodes?: string[],
    flags?: flag_type[],
    dealposOrderNumber?: string,
  ) => void;
  currentBranch: any;
  ignoredDealposIds?: string[];
  onIgnoreDealposId?: (orderId: string) => void;
  isBengkelOpen?: boolean;
  isOvertimeActive?: boolean;
  isDebriefInProgress?: boolean;
  debriefFrozenAt?: string | null;
  overtimeTicketIds?: string[];
  overtimeStoppedAt?: string | null;
  onToggleBengkelOpen?: (isOpen: boolean) => void;
  onToggleOvertime?: (isActive: boolean) => void;
  onStopOvertime?: () => Promise<void> | void;
}

const Dashboard: React.FC<DashboardProps> = ({
  tickets,
  mechanics,
  services,
  customers,
  addTicket,
  updateTicketStatus,
  updateTicketServices,
  connectTicketToDealpos,
  currentBranch,
  ignoredDealposIds = [],
  onIgnoreDealposId,
  isBengkelOpen = true,
  isOvertimeActive = false,
  isDebriefInProgress = false,
  debriefFrozenAt = null,
  overtimeTicketIds = [],
  overtimeStoppedAt = null,
  onToggleBengkelOpen,
  onToggleOvertime,
  onStopOvertime,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reconcileTicketId, setReconcileTicketId] = useState<string | null>(null);
  const [isDebriefModalOpen, setIsDebriefModalOpen] = useState(false);
  const [confirmStopOvertime, setConfirmStopOvertime] = useState(false);

  const isTicketLockedForAdmin = (ticket: Ticket) => {
    if (debriefFrozenAt || isDebriefInProgress) {
      return true;
    }
    if (!isBengkelOpen && !isOvertimeActive) {
      return true;
    }
    if (isOvertimeActive) {
      const ids = Array.isArray(overtimeTicketIds) ? overtimeTicketIds : [];
      return !ids.includes(ticket.id);
    }
    return false;
  };

  const handleReconcile = (ticket: Ticket) => {
    setReconcileTicketId(ticket.id);
    setIsAddModalOpen(true);
  };
  const [assignModalData, setAssignModalData] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  const [pendingModalData, setPendingModalData] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  const [cancelModalData, setCancelModalData] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  const [editModalData, setEditModalData] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  const [kendalaModalData, setKendalaModalData] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  const [followUpModalData, setFollowUpModalData] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });

  // --- KPI LOGIC CORRECTION ---
  const kpi = useMemo(() => {
    const todayStr = new Date().toDateString();

    // 1. LIVE STATUS (Current Active Inventory)
    // These do NOT reset daily. They show what is physically in the shop RIGHT NOW.
    const waiting = tickets.filter((t) => t.status === "waiting").length;
    const inProgress = tickets.filter(
      (t) => t.status === "active" || t.status === "pending",
    ).length;
    const ready = tickets.filter((t) => t.status === "ready").length;

    // 2. DAILY PERFORMANCE (Reset Daily)
    // Only counts items that were finalized TODAY.
    const finishedToday = tickets.filter(
      (t) =>
        t.status === "done" &&
        t.timestamps.finished &&
        new Date(t.timestamps.finished).toDateString() === todayStr,
    ).length;

    const cancelledToday = tickets.filter(
      (t) =>
        t.status === "cancelled" &&
        // Fallback to arrival time if finished time isn't set for cancellations
        ((t.timestamps.finished &&
          new Date(t.timestamps.finished).toDateString() === todayStr) ||
          (!t.timestamps.finished &&
            new Date(t.timestamps.arrival).toDateString() === todayStr)),
    ).length;

    // Total handled today = Current Active + Done Today + Cancelled Today
    // This gives a sense of "Total Daily Volume"
    const total = waiting + inProgress + ready + finishedToday + cancelledToday;

    return {
      total,
      waiting,
      inProgress,
      ready,
      finished: finishedToday,
      cancelled: cancelledToday,
    };
  }, [tickets]);

  // Filter lists for columns (Show ALL tickets in these states, regardless of date)
  const waitingTickets = tickets.filter((t) => t.status === "waiting");
  const activeTickets = tickets.filter(
    (t) => t.status === "active" || t.status === "pending",
  );
  const readyTickets = tickets.filter((t) => t.status === "ready");

  const now = new Date().getTime();
  const followUpTickets = tickets.filter((t) => {
    if (t.status !== "taken" || !t.timestamps.taken) return false;
    if (isTicketExcludedFromFollowUp(t)) return false;
    const takenTime = new Date(t.timestamps.taken).getTime();
    const daysSinceTaken = (now - takenTime) / (1000 * 3600 * 24);
    return daysSinceTaken >= 3;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight italic">
              Dashboard Admin
            </h2>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              currentBranch === "mk" 
                ? "bg-blue-100 text-blue-800 border border-blue-200" 
                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}>
              <MapPin size={10} />
              {currentBranch === "mk" ? "Muara Karang" : "PIK 2"}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-bold">
            Kelola operasional harian bengkel
          </p>
        </div>
        <button
          onClick={() => {
            const isActionDisabled = isOvertimeActive || !!debriefFrozenAt || isDebriefInProgress || (!isBengkelOpen && !isOvertimeActive);
            if (isActionDisabled) return;
            setIsAddModalOpen(true);
          }}
          disabled={isOvertimeActive || !!debriefFrozenAt || isDebriefInProgress || (!isBengkelOpen && !isOvertimeActive)}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-xs md:text-sm ${
            (isOvertimeActive || !!debriefFrozenAt || isDebriefInProgress || (!isBengkelOpen && !isOvertimeActive))
              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none active:scale-100"
              : "bg-slate-900 text-white hover:bg-black"
          }`}
        >
          <Plus size={18} />
          {debriefFrozenAt || isDebriefInProgress
            ? "Antrian Terkunci (Debrief)"
            : !isBengkelOpen && !isOvertimeActive
            ? "Bengkel Tutup (Terkunci)"
            : isOvertimeActive
            ? "Daftar Terkunci (OT)"
            : "Tambah Pelanggan"
          }
        </button>
      </div>

      {/* SECTION: OPERATIONAL HOURS CONTROLS (BUKA / TUTUP BENGKEL & OVERTIME) */}
      <div className="bg-slate-50 border border-slate-200/60 p-4 md:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className={`p-3 rounded-full flex items-center justify-center ${
            isBengkelOpen 
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
              : "bg-rose-50 text-rose-600 border border-rose-200"
          }`}>
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBengkelOpen ? "bg-emerald-400" : "bg-rose-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isBengkelOpen ? "bg-emerald-500" : "bg-rose-500"}`}></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">OPERASIONAL BENGKEL</span>
              {isOvertimeActive && (
                <span className="text-[10px] bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-black animate-pulse flex items-center gap-0.5">
                  ⚡ OVERTIME
                </span>
              )}
            </div>
            <p className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
              Status Bengkel: <span className={isBengkelOpen ? "text-emerald-600" : "text-rose-600"}>{isBengkelOpen ? "BUKA" : "TUTUP"}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* BUKA / TUTUP BENGKEL TOGGLER BUTTONS */}
          {isOvertimeActive ? (
            confirmStopOvertime ? (
              <div className="flex items-center gap-1.5 animate-bounce">
                <button
                  onClick={() => {
                    if (onStopOvertime) {
                      onStopOvertime();
                    } else {
                      onToggleOvertime?.(false);
                      onToggleBengkelOpen?.(false);
                    }
                    setConfirmStopOvertime(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all whitespace-nowrap"
                >
                  ✅ Ya, Selesai OT!
                </button>
                <button
                  onClick={() => setConfirmStopOvertime(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all whitespace-nowrap"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setConfirmStopOvertime(true);
                  setTimeout(() => setConfirmStopOvertime(false), 5000);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow flex items-center gap-1.5 transition-all animate-pulse"
              >
                🏁 Selesai Lembur
              </button>
            )
          ) : isBengkelOpen ? (
            <button
              onClick={() => setIsDebriefModalOpen(true)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow flex items-center gap-1.5 transition-all ${
                isDebriefInProgress
                  ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {isDebriefInProgress ? "🔄 LANJUT REKAP" : "TUTUP TOKO"}
            </button>
          ) : (
            <button
              onClick={() => onToggleBengkelOpen?.(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow flex items-center gap-1.5 transition-all"
            >
              BUKA BENGKEL
            </button>
          )}
        </div>
      </div>

      {isOvertimeActive && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 shadow-sm flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 text-amber-500 animate-pulse mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-900 font-sans">
            <span className="font-black uppercase block tracking-wider mb-0.5">Mode Overtime Aktif & Dashboard Terkunci</span>
            Waktu pengerjaan lembur dibatasi hanya untuk kartu-kartu pilihan admin. Lembur akan selesai otomatis jika seluruh kartu pilihan lembur telah diselesaikan, atau admin/mekanik dapat menyelesaikan lembur secara manual kapan saja dengan menekan tombol <strong className="uppercase">🏁 Selesai Lembur</strong>. Admin tidak dapat mendaftarkan sepeda baru atau memindahkan kartu lain selama lembur aktif.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <KpiCard
          title="Total Vol."
          value={kpi.total}
          icon={<Users size={16} className="text-purple-500" />}
        />
        <KpiCard
          title="Antri (Live)"
          value={kpi.waiting}
          icon={<Clock size={16} className="text-gray-500" />}
        />
        <KpiCard
          title="Kerja (Live)"
          value={kpi.inProgress}
          icon={<PlayCircle size={16} className="text-blue-500" />}
        />
        <KpiCard
          title="Siap (Live)"
          value={kpi.ready}
          icon={<PackageCheck size={16} className="text-emerald-500" />}
        />
        <KpiCard
          title="Selesai (Hari Ini)"
          value={kpi.finished}
          icon={<CheckCircle size={16} className="text-green-500" />}
        />
        <KpiCard
          title="Batal (Hari Ini)"
          value={kpi.cancelled}
          icon={<Ban size={16} className="text-red-500" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Waiting */}
        <Column
          title="Menunggu"
          color="bg-gray-400"
          count={waitingTickets.length}
        >
          {waitingTickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              actionLabel="Proses"
              onAction={() => {
                if (isOvertimeActive && overtimeTicketIds.includes(t.id) && t.overtimeMechanic) {
                  updateTicketStatus(t.id, "active", t.overtimeMechanic);
                } else {
                  setAssignModalData({ isOpen: true, ticket: t });
                }
              }}
              onCancel={() => setCancelModalData({ isOpen: true, ticket: t })}
              onEditServices={() =>
                setEditModalData({ isOpen: true, ticket: t })
              }
              onReconcile={handleReconcile}
              locked={isTicketLockedForAdmin(t)}
            />
          ))}
        </Column>

        {/* Active */}
        <Column
          title="Dikerjakan"
          color="bg-blue-500"
          count={activeTickets.length}
          bg="bg-blue-50/50"
        >
          {activeTickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              actionLabel={t.status === "pending" ? "Lanjutkan" : "Selesai"}
              onAction={() =>
                updateTicketStatus(
                  t.id,
                  t.status === "pending" ? "active" : "ready",
                )
              }
              secondaryActionLabel={t.status === "active" ? "Tunda" : undefined}
              onSecondaryAction={() =>
                setPendingModalData({ isOpen: true, ticket: t })
              }
              onCancel={() => setCancelModalData({ isOpen: true, ticket: t })}
              onChangeMechanic={() =>
                setAssignModalData({ isOpen: true, ticket: t })
              }
              onEditServices={() =>
                setEditModalData({ isOpen: true, ticket: t })
              }
              onReconcile={handleReconcile}
              locked={isTicketLockedForAdmin(t)}
            />
          ))}
        </Column>

        {/* Ready */}
        <Column
          title="Siap Diambil"
          color="bg-emerald-500"
          count={readyTickets.length}
          bg="bg-emerald-50/50"
        >
          {readyTickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              actionLabel="Unit Diambil"
              onAction={() => updateTicketStatus(t.id, "taken")}
              onReconcile={handleReconcile}
              locked={isTicketLockedForAdmin(t)}
            />
          ))}
        </Column>

        {/* Follow Up */}
        <Column
          title="Follow Up"
          color="bg-purple-500"
          count={followUpTickets.length}
          bg="bg-purple-50/50"
        >
          {followUpTickets.map((t) => {
            return (
              <TicketCard
                key={t.id}
                ticket={t}
                onReconcile={handleReconcile}
                locked={isTicketLockedForAdmin(t)}
                customActions={
                  <div className="mt-2 text-center">
                    <button
                      onClick={() => setFollowUpModalData({ isOpen: true, ticket: t })}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs py-2.5 rounded-lg shadow-sm transition-all hover:scale-[1.01] uppercase tracking-widest"
                    >
                      <MessageSquare size={14} /> Follow Up
                    </button>
                  </div>
                }
              />
            );
          })}
        </Column>
      </div>

      {/* Modals */}
      <CreateTicketModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setReconcileTicketId(null);
        }}
        services={services}
        customers={customers}
        onAdd={addTicket}
        onConnect={connectTicketToDealpos}
        tickets={tickets}
        currentBranch={currentBranch}
        ignoredDealposIds={ignoredDealposIds}
        onIgnoreDealposId={onIgnoreDealposId}
        initialManualTicketId={reconcileTicketId}
      />
      <AssignMechanicModal
        isOpen={assignModalData.isOpen}
        onClose={() => setAssignModalData({ isOpen: false, ticket: null })}
        ticket={assignModalData.ticket}
        mechanics={mechanics}
        onAssign={(id: any, m: any) => updateTicketStatus(id, "active", m)}
      />
      <PendingModal
        isOpen={pendingModalData.isOpen}
        onClose={() => setPendingModalData({ isOpen: false, ticket: null })}
        ticket={pendingModalData.ticket}
        onConfirm={(id: any, r: any) =>
          updateTicketStatus(id, "pending", undefined, r)
        }
      />
      <CancelModal
        isOpen={cancelModalData.isOpen}
        onClose={() => setCancelModalData({ isOpen: false, ticket: null })}
        ticket={cancelModalData.ticket}
        onConfirm={(id: any, r: any) =>
          updateTicketStatus(id, "cancelled", undefined, undefined, r)
        }
      />
      <EditServicesModal
        isOpen={editModalData.isOpen}
        onClose={() => setEditModalData({ isOpen: false, ticket: null })}
        ticket={editModalData.ticket}
        services={services}
        onUpdate={updateTicketServices}
      />
      <KendalaModal
        isOpen={kendalaModalData.isOpen}
        onClose={() => setKendalaModalData({ isOpen: false, ticket: null })}
        ticket={kendalaModalData.ticket}
        services={services}
        onConfirm={(ticket: any, notes: string, warrantyServices: string[]) => {
          updateTicketStatus(ticket.id, "done", undefined, undefined, undefined, 'Kendala');
          addTicket(
            ticket.customerName,
            ticket.phone,
            ticket.unitSepeda,
            warrantyServices,
            notes,
            ticket.customerId,
            ticket.dealposOrderId,
            undefined,
            undefined,
            ticket.dealposOrderNumber
          );
        }}
      />

      <FollowUpModal
        isOpen={followUpModalData.isOpen}
        onClose={() => setFollowUpModalData({ isOpen: false, ticket: null })}
        ticket={followUpModalData.ticket}
        onConfirm={(ticket: any, outcome: string, photoUrl?: string, wantsWarrantyClaim?: boolean) => {
          updateTicketStatus(ticket.id, "done", undefined, undefined, undefined, outcome, photoUrl);
          if (outcome === "Kendala" && wantsWarrantyClaim) {
            setKendalaModalData({ isOpen: true, ticket: ticket });
          }
        }}
      />

      <DebriefModal
        isOpen={isDebriefModalOpen}
        onClose={() => setIsDebriefModalOpen(false)}
        branch={currentBranch}
        tickets={tickets}
        mechanics={mechanics}
        isBengkelOpen={isBengkelOpen}
        isOvertimeActive={isOvertimeActive}
        isDebriefInProgress={isDebriefInProgress}
        debriefFrozenAt={debriefFrozenAt}
        overtimeTicketIds={overtimeTicketIds}
        overtimeStoppedAt={overtimeStoppedAt}
      />
    </div>
  );
};

const KpiCard = ({ title, value, icon }: any) => (
  <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-20 md:h-24 transition-transform hover:-translate-y-1">
    <div className="flex justify-between items-start">
      <p className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
        {title}
      </p>
      {icon}
    </div>
    <p className="text-xl md:text-2xl font-black text-slate-800">{value}</p>
  </div>
);

const Column = ({
  title,
  color,
  count,
  children,
  bg = "bg-slate-100/50",
}: any) => (
  <div className={`${bg} p-3 md:p-4 rounded-2xl border-2 border-slate-100`}>
    <h3 className="text-base md:text-lg font-black text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-tight italic">
      <span className={`w-3 h-3 rounded-full ${color} shadow-sm`}></span>
      {title}
      <span className="ml-auto bg-white border px-2.5 py-0.5 rounded-lg text-xs font-black shadow-sm">
        {count}
      </span>
    </h3>
    <div className="space-y-4">
      {count === 0 ? (
        <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl text-sm italic font-bold uppercase tracking-widest">
          Kosong
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

export default Dashboard;
