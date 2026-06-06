import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import MechanicMode from "./pages/MechanicMode";
import CustomerDisplay from "./pages/CustomerDisplay";
import Reports from "./pages/Reports";
import Performance from "./pages/Performance";
import Settings from "./pages/Settings";
import StorageMode from "./pages/StorageMode";
import StorageFormPage from "./pages/StorageFormPage";
import {
  Ticket,
  TicketStatus,
  MechanicDefinition,
  ServiceDefinition,
  Branch,
  Customer,
  StorageSlot,
  flag_type,
} from "./types";
import {
  subscribeToTickets,
  subscribeToMechanics,
  subscribeToServices,
  subscribeToCustomers,
  subscribeToStorage,
  initializeStorageSlots,
  addTicketToCloud,
  updateTicketStatusInCloud,
  updateTicketServicesInCloud,
  connectTicketToDealposOrderIdInCloud,
  addMechanicToCloud,
  updateMechanicInCloud,
  removeMechanicFromCloud,
  addServiceToCloud,
  updateServiceInCloud,
  removeServiceFromCloud,
  updateCustomerInCloud,
  removeCustomerFromCloud,
  subscribeToIgnoredDealpos,
  ignoreDealposOrderIdInCloud,
  subscribeToOperationalStatus,
  toggleBengkelOpenInCloud,
  toggleOvertimeInCloud,
  updateOperationalConfigInCloud,
  updateTicketInCloud,
} from "./services/ticketService";
import { MapPin } from "lucide-react";

// Branch Selection Component
const BranchSelection = ({ onSelect }: { onSelect: (b: Branch) => void }) => (
  <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
    <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="col-span-full text-center mb-4">
        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
          Daily Bike Jakarta
        </h1>
        <p className="text-slate-400 text-lg">
          Pilih Lokasi Cabang / Branch Location
        </p>
      </div>
      <button
        onClick={() => onSelect("mk")}
        className="group relative bg-blue-600 hover:bg-blue-500 rounded-3xl p-10 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.02] shadow-2xl border-4 border-blue-400/30"
      >
        <div className="bg-white/20 p-6 rounded-full text-white group-hover:scale-110 transition-transform">
          <MapPin size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white uppercase tracking-wider">
            Muara Karang
          </h2>
          <p className="text-blue-200 font-bold mt-2">Pusat / Main Branch</p>
        </div>
      </button>
      <button
        onClick={() => onSelect("pik")}
        className="group relative bg-emerald-600 hover:bg-emerald-500 rounded-3xl p-10 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.02] shadow-2xl border-4 border-emerald-400/30"
      >
        <div className="bg-white/20 p-6 rounded-full text-white group-hover:scale-110 transition-transform">
          <MapPin size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white uppercase tracking-wider">
            PIK 2
          </h2>
          <p className="text-emerald-200 font-bold mt-2">
            Cabang Baru / New Branch
          </p>
        </div>
      </button>
    </div>
  </div>
);

function App() {
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(() => {
    try {
      return localStorage.getItem(
        "daily_bike_selected_branch",
      ) as Branch | null;
    } catch (e) {
      console.warn("LocalStorage access failed (Security restricted?)", e);
      return null;
    }
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mechanics, setMechanics] = useState<MechanicDefinition[]>([]);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storageSlots, setStorageSlots] = useState<StorageSlot[]>([]);
  const [ignoredDealposIds, setIgnoredDealposIds] = useState<string[]>([]);

  const [isBengkelOpen, setIsBengkelOpen] = useState(true);
  const [isOvertimeActive, setIsOvertimeActive] = useState(false);
  const [isDebriefInProgress, setIsDebriefInProgress] = useState(false);
  const [debriefFrozenAt, setDebriefFrozenAt] = useState<string | null>(null);
  const [overtimeTicketIds, setOvertimeTicketIds] = useState<string[]>([]);
  const [overtimeStoppedAt, setOvertimeStoppedAt] = useState<string | null>(null);

  // Real-time subscriptions to Firestore
  useEffect(() => {
    // Reset all operational state when branch changes to avoid UI flicker/leaks between branches
    setIsBengkelOpen(true);
    setIsOvertimeActive(false);
    setIsDebriefInProgress(false);
    setDebriefFrozenAt(null);
    setOvertimeTicketIds([]);
    setOvertimeStoppedAt(null);

    const unsubscribeTickets = subscribeToTickets((updatedTickets) => {
      setTickets(updatedTickets);
    });
    const unsubscribeMechanics = subscribeToMechanics((updatedMechanics) => {
      setMechanics(updatedMechanics);
    });
    const unsubscribeServices = subscribeToServices((updatedServices) => {
      setServices(updatedServices);
    });
    const unsubscribeCustomers = subscribeToCustomers((updatedCustomers) => {
      setCustomers(updatedCustomers);
    });

    // Only subscribe to storage if we are in PIK branch or just globally (simplified)
    const unsubscribeStorage = subscribeToStorage((slots) => {
      setStorageSlots(slots);
      if (slots.length === 0) initializeStorageSlots();
    });

    const unsubscribeIgnoredDealpos = subscribeToIgnoredDealpos((updatedIds) => {
      setIgnoredDealposIds(updatedIds);
    });

    let unsubscribeOps = () => {};
    if (currentBranch) {
      unsubscribeOps = subscribeToOperationalStatus(currentBranch, (data) => {
        setIsBengkelOpen(data.isBengkelOpen);
        setIsOvertimeActive(data.isOvertimeActive);
        setIsDebriefInProgress(!!data.isDebriefInProgress);
        setDebriefFrozenAt(data.debriefFrozenAt || null);
        setOvertimeTicketIds(data.overtimeTicketIds || []);
        setOvertimeStoppedAt(data.overtimeStoppedAt || null);
      });
    }

    return () => {
      unsubscribeTickets();
      unsubscribeMechanics();
      unsubscribeServices();
      unsubscribeCustomers();
      unsubscribeStorage();
      unsubscribeIgnoredDealpos();
      unsubscribeOps();
    };
  }, [currentBranch]);



  const handleBranchSelect = (branch: Branch) => {
    setCurrentBranch(branch);
    try {
      localStorage.setItem("daily_bike_selected_branch", branch);
    } catch (e) {
      console.warn("Could not save branch to LocalStorage", e);
    }
  };

  const handleSwitchBranch = () => {
    setCurrentBranch(null);
    try {
      localStorage.removeItem("daily_bike_selected_branch");
    } catch (e) {
      console.warn("Could not clear branch from LocalStorage", e);
    }
  };

  const branchTickets = useMemo(() => {
    if (!currentBranch) return [];
    return tickets.filter((t) => t.branch === currentBranch);
  }, [tickets, currentBranch]);

  const branchMechanics = useMemo(() => {
    if (!currentBranch) return [];
    return mechanics.filter((m) => m.branches.includes(currentBranch));
  }, [mechanics, currentBranch]);

  const branchServices = useMemo(() => {
    if (!currentBranch) return [];
    return services.filter((s) => s.branches.includes(currentBranch));
  }, [services, currentBranch]);

  const isActionProhibitedForAdmin = (ticketId?: string) => {
    if (debriefFrozenAt || isDebriefInProgress) {
      return true;
    }
    if (!isBengkelOpen && !isOvertimeActive) {
      return true;
    }
    if (isOvertimeActive) {
      if (!ticketId) {
        return true; // Cannot add new tickets during overtime
      }
      const ids = Array.isArray(overtimeTicketIds) ? overtimeTicketIds : [];
      return !ids.includes(ticketId);
    }
    return false;
  };

  const addTicket = (
    name: string,
    phone: string,
    unit: string,
    svcs: string[],
    notes: string,
    customerId?: string,
    dealposOrderId?: string,
    flags?: flag_type[],
    serviceSkuCodes?: string[],
  ) => {
    if (!currentBranch) return;
    if (isActionProhibitedForAdmin()) {
      console.warn("Action blocked: operational state is locked/frozen");
      return;
    }
    addTicketToCloud(currentBranch, name, phone, unit, svcs, notes, customerId, dealposOrderId, flags, serviceSkuCodes);
  };

  const updateTicketStatus = (
    id: string,
    status: TicketStatus,
    mechanic?: string,
    notes?: string,
    reason?: string,
    followUpResult?: string,
    followUpPhotoUrl?: string
  ) => {
    if (isActionProhibitedForAdmin(id)) {
      console.warn("Action blocked: ticket is locked/frozen");
      return;
    }
    const ticketToUpdate = tickets.find((t) => t.id === id);
    if (!ticketToUpdate) return;
    updateTicketStatusInCloud(
      id,
      ticketToUpdate,
      status,
      mechanic,
      notes,
      reason,
      followUpResult,
      followUpPhotoUrl
    );
  };

  const updateTicketServices = (
    id: string,
    serviceTypes: string[],
    notes?: string,
  ) => {
    if (isActionProhibitedForAdmin(id)) {
      console.warn("Action blocked: ticket is locked/frozen");
      return;
    }
    updateTicketServicesInCloud(id, serviceTypes, notes);
  };

  const connectTicketToDealpos = (
    id: string,
    dealposOrderId: string,
    customerName?: string,
    phone?: string,
    serviceSkuCodes?: string[],
    flags?: flag_type[],
  ) => {
    if (isActionProhibitedForAdmin(id)) {
      console.warn("Action blocked: ticket is locked/frozen");
      return;
    }
    connectTicketToDealposOrderIdInCloud(id, dealposOrderId, customerName, phone, serviceSkuCodes, flags);
  };

  // Settings Handlers
  const handleAddMechanic = (name: string, branches: Branch[]) =>
    addMechanicToCloud(name, branches);
  const handleUpdateMechanic = (id: string, name: string, branches: Branch[]) =>
    updateMechanicInCloud(id, name, branches);
  const handleRemoveMechanic = (id: string) => removeMechanicFromCloud(id);

  const handleAddService = (name: string, branches: Branch[]) =>
    addServiceToCloud(name, branches);
  const handleUpdateService = (id: string, name: string, branches: Branch[]) =>
    updateServiceInCloud(id, name, branches);
  const handleRemoveService = (id: string) => removeServiceFromCloud(id);

  const handleUpdateCustomer = (
    id: string,
    name: string,
    phone: string,
    bikes: string[],
  ) => updateCustomerInCloud(id, name, phone, bikes);
  const handleRemoveCustomer = (id: string) => removeCustomerFromCloud(id);

  const isStoppingOvertime = useRef(false);

  const handleStopOvertime = useCallback(async () => {
    if (!currentBranch || isStoppingOvertime.current) return;
    isStoppingOvertime.current = true;
    try {
      // Clear overtime pre-selected mechanics for all unprocessed queue cards in the Menunggu section
      const waitingOvertimeTickets = tickets.filter(
        (t) => t.branch === currentBranch && t.status === "waiting" && t.overtimeMechanic
      );
      for (const t of waitingOvertimeTickets) {
        await updateTicketInCloud(t.id, { overtimeMechanic: null });
      }

      await updateOperationalConfigInCloud(currentBranch, {
        isOvertimeActive: false,
        isBengkelOpen: false, // End of overtime closes the workshop as well
        overtimeStoppedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to stop overtime:", err);
    }
  }, [currentBranch, tickets]);

  // Reset the stop lock state when overtime is no longer active
  useEffect(() => {
    if (!isOvertimeActive) {
      isStoppingOvertime.current = false;
    }
  }, [isOvertimeActive]);

  // Auto-finish overtime when all selected overtime tickets are finished
  useEffect(() => {
    if (isOvertimeActive && overtimeTicketIds && overtimeTicketIds.length > 0 && tickets.length > 0 && !isStoppingOvertime.current) {
      const selectedTickets = tickets.filter(t => overtimeTicketIds.includes(t.id));
      if (selectedTickets.length > 0) {
        // Active overtime tickets are those whose status is 'active', 'waiting', or 'pending'
        const activeOvertimeTickets = selectedTickets.filter(
          (t) => t.status === "active" || t.status === "waiting" || t.status === "pending"
        );
        if (activeOvertimeTickets.length === 0) {
          console.log("All selected overtime tickets are completed! Auto-finishing overtime...");
          handleStopOvertime();
        }
      }
    }
  }, [tickets, isOvertimeActive, overtimeTicketIds, handleStopOvertime]);

  return (
    <Router>
      <Routes>
        {/* Public Route for Storage Form */}
        <Route path="/inquiry" element={<StorageFormPage />} />

        {/* Main App Routes */}
        <Route
          path="*"
          element={
            !currentBranch ? (
              <BranchSelection onSelect={handleBranchSelect} />
            ) : (
              <Layout
                currentBranch={currentBranch}
                onSwitchBranch={handleSwitchBranch}
              >
                <Routes>
                  <Route
                    path="/"
                    element={
                      <Dashboard
                        tickets={branchTickets}
                        mechanics={branchMechanics}
                        services={branchServices}
                        customers={customers}
                        addTicket={addTicket}
                        updateTicketStatus={updateTicketStatus}
                        updateTicketServices={updateTicketServices}
                        connectTicketToDealpos={connectTicketToDealpos}
                        currentBranch={currentBranch}
                        ignoredDealposIds={ignoredDealposIds}
                        onIgnoreDealposId={ignoreDealposOrderIdInCloud}
                        isBengkelOpen={isBengkelOpen}
                        isOvertimeActive={isOvertimeActive}
                        isDebriefInProgress={isDebriefInProgress}
                        debriefFrozenAt={debriefFrozenAt}
                        overtimeTicketIds={overtimeTicketIds}
                        overtimeStoppedAt={overtimeStoppedAt}
                        onToggleBengkelOpen={async (isOpen) => {
                          if (isOpen) {
                            await updateOperationalConfigInCloud(currentBranch, {
                              isBengkelOpen: true,
                              isOvertimeActive: false,
                              isDebriefInProgress: false,
                              debriefFrozenAt: null,
                              overtimeTicketIds: [],
                              overtimeStoppedAt: null,
                            });
                          } else {
                            await updateOperationalConfigInCloud(currentBranch, {
                              isBengkelOpen: false,
                              isOvertimeActive: false,
                              isDebriefInProgress: false,
                              debriefFrozenAt: null,
                              overtimeTicketIds: [],
                              overtimeStoppedAt: null,
                            });
                          }
                        }}
                        onToggleOvertime={(isOvertime) => toggleOvertimeInCloud(currentBranch, isOvertime)}
                        onStopOvertime={handleStopOvertime}
                      />
                    }
                  />
                  <Route
                    path="/mechanic"
                    element={
                      <MechanicMode
                        tickets={branchTickets}
                        mechanics={branchMechanics}
                        services={branchServices}
                        updateTicketStatus={updateTicketStatus}
                        updateTicketServices={updateTicketServices}
                        isDebriefInProgress={isDebriefInProgress}
                        isBengkelOpen={isBengkelOpen}
                        isOvertimeActive={isOvertimeActive}
                        overtimeTicketIds={overtimeTicketIds}
                        onStopOvertime={handleStopOvertime}
                      />
                    }
                  />

                  {currentBranch === "pik" && (
                    <Route
                      path="/storage"
                      element={
                        <StorageMode
                          slots={storageSlots}
                          customers={customers}
                        />
                      }
                    />
                  )}

                  <Route
                    path="/display"
                    element={
                      <CustomerDisplay
                        tickets={branchTickets}
                        branch={currentBranch}
                      />
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <Reports
                        tickets={branchTickets}
                        storageSlots={storageSlots}
                        currentBranch={currentBranch}
                        isBengkelOpen={isBengkelOpen}
                        isOvertimeActive={isOvertimeActive}
                        isDebriefInProgress={isDebriefInProgress}
                        debriefFrozenAt={debriefFrozenAt}
                        overtimeTicketIds={overtimeTicketIds}
                        overtimeStoppedAt={overtimeStoppedAt}
                      />
                    }
                  />
                  <Route
                    path="/performance"
                    element={
                      <Performance
                        tickets={branchTickets}
                        mechanics={branchMechanics}
                        currentBranch={currentBranch}
                      />
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <Settings
                        currentBranch={currentBranch}
                        mechanics={mechanics}
                        services={services}
                        customers={customers}
                        onAddMechanic={handleAddMechanic}
                        onUpdateMechanic={handleUpdateMechanic}
                        onRemoveMechanic={handleRemoveMechanic}
                        onAddService={handleAddService}
                        onUpdateService={handleUpdateService}
                        onRemoveService={handleRemoveService}
                        onUpdateCustomer={handleUpdateCustomer}
                        onRemoveCustomer={handleRemoveCustomer}
                      />
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
