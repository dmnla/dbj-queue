import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Search,
  ChevronDown,
  Check,
  UserCog,
  User,
  Phone,
  Bike,
  Calendar,
  Camera,
  History,
  Image as ImageIcon,
  PlusCircle,
  AlertCircle,
  Copy,
  UploadCloud,
  Trash2,
  Link2,
} from "lucide-react";
import {
  Ticket,
  Customer,
  StorageSlot,
  StorageLog,
  StorageRequest,
  flag_type,
} from "../types";
import { formatTime, uploadFollowUpScreenshot } from "../services/ticketService";

interface ModalBaseProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

const ModalBase: React.FC<ModalBaseProps> = ({
  title,
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-lg",
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]`}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

// ... (MultiSearchableSelect, CustomerSearchInput, CreateTicketModal, AssignMechanicModal, PendingModal, CancelModal, EditServicesModal remain unchanged)
const MultiSearchableSelect = ({
  options,
  selectedValues,
  onChange,
  placeholder,
}: {
  options: string[];
  selectedValues: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const filteredOptions = options
    .filter((opt) => opt.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt))
      onChange(selectedValues.filter((v) => v !== opt));
    else onChange([...selectedValues, opt]);
  };
  return (
    <div className="relative" ref={wrapperRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl flex flex-wrap gap-2 min-h-[52px] justify-between items-center cursor-pointer hover:border-blue-400 transition-all shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          {selectedValues.length === 0 && (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
          {selectedValues.map((v) => (
            <span
              key={v}
              className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 shadow-sm"
            >
              {v}
              <X
                size={14}
                className="hover:text-red-200"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(v);
                }}
              />
            </span>
          ))}
        </div>
        <ChevronDown
          size={20}
          className={`transition-transform text-slate-400 ${isOpen ? "rotate-180" : ""}`}
        />
      </div>
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-slate-50 relative">
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              autoFocus
              className="w-full pl-10 pr-4 py-2 bg-white text-slate-900 border-2 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Cari layanan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm font-medium italic">
                Layanan tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt}
                  className={`px-5 py-3 cursor-pointer text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${selectedValues.includes(opt) ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 font-medium"}`}
                  onClick={() => toggleOption(opt)}
                >
                  {opt}
                  {selectedValues.includes(opt) && (
                    <Check size={18} className="text-blue-600" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const inputClass =
  "w-full p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium transition-all shadow-sm placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500";

export const CustomerSearchInput = ({
  customers,
  onSelect,
  onClear,
}: {
  customers: Customer[];
  onSelect: (c: Customer) => void;
  onClear: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const filtered = useMemo(() => {
    if (!query) return [];
    const lowerQ = query.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(lowerQ) || c.phone.includes(lowerQ),
      )
      .slice(0, 5);
  }, [customers, query]);
  const handleSelect = (c: Customer) => {
    setQuery(c.name);
    onSelect(c);
    setIsFocused(false);
  };
  return (
    <div className="relative">
      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
        Cari Pelanggan
      </label>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          className={`${inputClass} pl-10`}
          placeholder="Ketik nama atau no. telepon..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onClear();
          }}
          onFocus={() => setIsFocused(true)}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              onClear();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {isFocused && query && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-0"
              >
                <div className="font-bold text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500 flex gap-2">
                  <span>{c.phone}</span>
                  <span>• {c.bikes?.length || 0} Sepeda</span>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">
              Pelanggan baru? Isi formulir di bawah.
            </div>
          )}
        </div>
      )}
    </div>
  );
};export const CreateTicketModal = ({
  isOpen,
  onClose,
  services,
  customers,
  onAdd,
  onConnect,
  tickets = [],
  currentBranch = "mk",
  ignoredDealposIds = [],
  onIgnoreDealposId,
  initialManualTicketId,
}: any) => {
  const [dealposStep, setDealposStep] = useState<"fetch" | "select-order" | "configure-booking" | "manual">("fetch");
  const [connectionMode, setConnectionMode] = useState<"new" | "connect">("new");
  const [selectedManualTicketId, setSelectedManualTicketId] = useState<string>("");
  const [dealposOrders, setDealposOrders] = useState<any[]>([]);
  const [selectedDealposOrder, setSelectedDealposOrder] = useState<any | null>(null);
  const [isLoadingDealpos, setIsLoadingDealpos] = useState(false);
  const [dealposError, setDealposError] = useState<string | null>(null);
  const [dealposSearch, setDealposSearch] = useState("");
  const [dealposCustomerName, setDealposCustomerName] = useState("");
  const [dealposPhone, setDealposPhone] = useState("");
  const [confirmIgnoreOrderId, setConfirmIgnoreOrderId] = useState<string | null>(null);

  const [bikesConfig, setBikesConfig] = useState<Array<{
    id: number;
    unit: string;
    phone: string;
    servicesSelected: string[];
    notes: string;
  }>>([]);

  // States for Manual Creating
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [unit, setUnit] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // States for dedicated reconciliation
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [recDropdownOpen, setRecDropdownOpen] = useState(false);
  const [recInvoiceInput, setRecInvoiceInput] = useState("");
  const [recInvoiceResult, setRecInvoiceResult] = useState<{
    loading: boolean;
    found: boolean;
    error?: string;
    OrderID?: string;
    Number?: string;
    CustomerName?: string;
    Phone?: string;
    Variants?: any[];
    Created?: string | null;
  } | null>(null);
  const [recSelectedOrderID, setRecSelectedOrderID] = useState<string | null>(null);

  const handleRecSearchInvoice = async () => {
    if (!recInvoiceInput.trim()) return;
    setRecInvoiceResult({ loading: true, found: false });
    setRecSelectedOrderID(null);
    try {
      const cleanNum = recInvoiceInput.trim().replace(/^#+/, "");
      const res = await fetch(`/api/dealpos?branch=${currentBranch}&invoiceNumber=${encodeURIComponent(cleanNum)}`);
      if (!res.ok) {
        throw new Error(`Invoice tidak ditemukan atau DealPOS error. (Status ${res.status})`);
      }
      const data = await res.json();
      const num = data.Number;
      const custName = data.Customer?.Name || data.CustomerName || "Nama Tidak Diketahui";
      const phoneVal = data.Customer?.Phone || data.Customer?.Cell || "";
      const orderId = data.InvoiceID || data.OrderID || data.invoiceId || data.orderId || "";
      const createdTime = data.Created || data.Date || data.created || data.date || null;
      
      if (!orderId) {
        throw new Error("DealPOS API tidak mengembalikan ID invoice/order.");
      }

      setRecInvoiceResult({
        loading: false,
        found: true,
        OrderID: orderId,
        Number: num,
        CustomerName: custName,
        Phone: phoneVal,
        Variants: data.Variants || data.variants || [],
        Created: createdTime
      });
      setRecSelectedOrderID(orderId);
    } catch (e: any) {
      setRecInvoiceResult({
        loading: false,
        found: false,
        error: e.message || "Unknown error searching invoice"
      });
    }
  };

  const handleRecConnectSubmit = async () => {
    if (!initialManualTicketId || !recSelectedOrderID || !onConnect) return;
    try {
      const custName = recInvoiceResult?.found ? recInvoiceResult.CustomerName : (dealposOrders.find(o => o.OrderID === recSelectedOrderID)?.Customer || reconcilingTicket?.customerName || "Unknown");
      const phoneNum = recInvoiceResult?.found ? recInvoiceResult.Phone : (dealposOrders.find(o => o.OrderID === recSelectedOrderID)?.Phone || reconcilingTicket?.phone || "");
      
      // Determine SKU codes of the connected DealPOS order
      const skuCodes: string[] = [];
      const orderFromList = dealposOrders.find(o => o.OrderID === recSelectedOrderID);
      const variants = recInvoiceResult?.found ? (recInvoiceResult.Variants || []) : (orderFromList?.Variants || orderFromList?.variants || []);
      
      variants.forEach((v: any) => {
        const code = v.Code || v.ItemID || "";
        if (code) skuCodes.push(code);
      });

      const flags: flag_type[] = [];
      const createdStr = recInvoiceResult?.found ? recInvoiceResult.Created : orderFromList?.Created;
      if (createdStr) {
        const createdTimestamp = new Date(createdStr).getTime();
        const diffMs = Date.now() - createdTimestamp;
        const diffMinutes = diffMs / (1000 * 60);
        if (diffMinutes > 15) {
          flags.push(flag_type.TELAT_UPDATE_ANTRIAN);
        }
      }

      onConnect(initialManualTicketId, recSelectedOrderID, custName, phoneNum, skuCodes, flags);
      onClose();
      // Reset rec states
      setRecSearchQuery("");
      setRecDropdownOpen(false);
      setRecInvoiceInput("");
      setRecInvoiceResult(null);
      setRecSelectedOrderID(null);
    } catch (err) {
      console.error("Failed to connect", err);
    }
  };

  const reconcilingTicket = useMemo(() => {
    if (!initialManualTicketId) return null;
    return (tickets || []).find((t: any) => t.id === initialManualTicketId);
  }, [tickets, initialManualTicketId]);

  const serviceNames = useMemo(
    () => services.map((s: any) => s.name),
    [services]
  );

  const fetchDealposOrders = async () => {
    setIsLoadingDealpos(true);
    setDealposError(null);
    setDealposStep("fetch");
    try {
      const ordersRes = await fetch(`/api/dealpos?branch=${currentBranch}`);

      if (!ordersRes.ok) {
        const errorData = await ordersRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Gagal mengambil data pesanan DEALPOS (HTTP STATUS: ${ordersRes.status})`);
      }

      const ordersData = await ordersRes.json();
      const rawData = ordersData.Data || ordersData.data || [];

      // Group variants of same OrderID together
      const groups: { [orderId: string]: any } = {};
      const seenItems = new Set<string>();

      for (const entry of rawData) {
        const orderId = entry.OrderID;
        if (!orderId) continue;

        if (!groups[orderId]) {
          groups[orderId] = {
            OrderID: orderId,
            Customer: entry.Customer || "UNKNOWN",
            Phone: entry.Phone || entry.Contact || entry.CustomerContact || entry.CustomerMobile || "",
            ParkLabel: entry.ParkLabel || "",
            Created: entry.Created || "",
            Number: entry.Number || "",
            Note: entry.Note || "",
            Variants: [],
          };
        }

        if (entry.Variants && Array.isArray(entry.Variants)) {
          for (const variant of entry.Variants) {
            const variantUniq = `${orderId}_${variant.ItemID || variant.Code || variant.Name}`;
            if (!seenItems.has(variantUniq)) {
              seenItems.add(variantUniq);
              groups[orderId].Variants.push(variant);
            }
          }
        }
      }

      // Filter: at least one variant starts with "DBJS"
      const eligibleGroups = Object.values(groups).filter((g: any) => {
        return g.Variants.some((v: any) => {
          const code = v.Code || "";
          const itemId = v.ItemID || "";
          return code.startsWith("DBJS") || itemId.startsWith("DBJS");
        });
      });

      // Filter out OrderIDs that are already in active/waiting tickets state or ignored
      const importedOrderIds = new Set(
        (tickets || [])
          .map((t: any) => t.dealposOrderId)
          .filter((id: any) => !!id)
      );
      const ignoredIdsSet = new Set(ignoredDealposIds || []);

      const finalGroupedOrders = eligibleGroups.filter(
        (g: any) => !importedOrderIds.has(g.OrderID) && !ignoredIdsSet.has(g.OrderID)
      );

      setDealposOrders(finalGroupedOrders);
      setDealposStep("select-order");
    } catch (err: any) {
      console.error(err);
      setDealposError(err.message || "Gagal berkomunikasi dengan DEALPOS.");
      setDealposStep("select-order");
    } finally {
      setIsLoadingDealpos(false);
    }
  };

  const activeManualTickets = useMemo(() => {
    return (tickets || []).filter((t: any) => {
      return (
        t.branch === currentBranch &&
        t.status !== "done" &&
        t.status !== "cancelled" &&
        !t.dealposOrderId
      );
    });
  }, [tickets, currentBranch]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDealposOrder(null);
      setBikesConfig([]);
      setDealposSearch("");
      setDealposError(null);
      setConfirmIgnoreOrderId(null);
      if (initialManualTicketId) {
        setConnectionMode("connect");
        setSelectedManualTicketId(initialManualTicketId);
      } else {
        setConnectionMode("new");
        setSelectedManualTicketId("");
      }
      fetchDealposOrders();
    }
  }, [isOpen, initialManualTicketId]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    if (c.bikes && c.bikes.length === 1) setUnit(c.bikes[0]);
    else setUnit("");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && phone.trim() && selectedServices.length > 0 && unit) {
      onAdd(name, phone.trim(), unit, selectedServices, notes, selectedCustomer?.id);
      onClose();
      setName("");
      setPhone("");
      setUnit("");
      setSelectedServices([]);
      setNotes("");
      setSelectedCustomer(null);
    }
  };

  const handleSelectOrder = (order: any) => {
    setSelectedDealposOrder(order);
    setDealposCustomerName(order.Customer || "Unknown");
    setDealposPhone(order.Phone || order.Contact || "");

    const dbjsServices = order.Variants.filter((v: any) => {
      const code = v.Code || "";
      const itemId = v.ItemID || "";
      return code.startsWith("DBJS") || itemId.startsWith("DBJS");
    });

    let initialBikesCount = 1;
    let totalQty = 0;
    dbjsServices.forEach((v: any) => {
      const qty = Number(v.Quantity || v.quantity || v.Qty || v.qty || 1);
      totalQty += qty;
    });

    if (totalQty > 0) {
      initialBikesCount = totalQty;
    }

    const initialBikes = [];
    for (let i = 1; i <= initialBikesCount; i++) {
      initialBikes.push({
        id: i,
        unit: "",
        phone: "",
        servicesSelected: dbjsServices.map((v: any) => v.Name),
        notes: "",
      });
    }

    setBikesConfig(initialBikes);
    setDealposStep("configure-booking");
  };

  const handleBikesCountChange = (count: number) => {
    const dbjsServices = selectedDealposOrder?.Variants.filter((v: any) => {
      const code = v.Code || "";
      const itemId = v.ItemID || "";
      return code.startsWith("DBJS") || itemId.startsWith("DBJS");
    }) || [];

    setBikesConfig((prev) => {
      const next = [...prev];
      if (count > prev.length) {
        for (let i = prev.length + 1; i <= count; i++) {
          next.push({
            id: i,
            unit: "",
            phone: prev[0]?.phone || "",
            servicesSelected: dbjsServices.map((v: any) => v.Name),
            notes: "",
          });
        }
      } else if (count < prev.length) {
        next.splice(count);
      }
      return next;
    });
  };

  const handleConfirmDealposBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealposOrder || !dealposPhone.trim()) return;

    if (connectionMode === "connect") {
      if (selectedManualTicketId && onConnect) {
        // Collect all SKU codes from selectedDealposOrder
        const skuCodes: string[] = [];
        if (selectedDealposOrder.Variants) {
          selectedDealposOrder.Variants.forEach((v: any) => {
            const code = v.Code || v.ItemID || "";
            if (code) skuCodes.push(code);
          });
        }

        const flags: flag_type[] = [];
        if (selectedDealposOrder.Created) {
          const createdTimestamp = new Date(selectedDealposOrder.Created).getTime();
          const diffMs = Date.now() - createdTimestamp;
          const diffMinutes = diffMs / (1000 * 60);
          if (diffMinutes > 15) {
            flags.push(flag_type.TELAT_UPDATE_ANTRIAN);
          }
        }

        onConnect(selectedManualTicketId, selectedDealposOrder.OrderID, dealposCustomerName, dealposPhone, skuCodes, flags);
      }
    } else {
      const flags: flag_type[] = [];
      if (selectedDealposOrder.Created) {
        const createdTimestamp = new Date(selectedDealposOrder.Created).getTime();
        const diffMs = Date.now() - createdTimestamp;
        const diffMinutes = diffMs / (1000 * 60);
        if (diffMinutes > 15) {
          flags.push(flag_type.TELAT_UPDATE_ANTRIAN);
        }
      }

      for (const bike of bikesConfig) {
        // Match each selected service name to find its SKU code
        const skuCodes: string[] = [];
        if (bike.servicesSelected && selectedDealposOrder.Variants) {
          bike.servicesSelected.forEach((sName: string) => {
            const matched = selectedDealposOrder.Variants.find((v: any) => v.Name === sName);
            if (matched) {
              const code = matched.Code || matched.ItemID || "";
              if (code) skuCodes.push(code);
            }
          });
        }

        onAdd(
          dealposCustomerName || "Unknown",
          dealposPhone,
          bike.unit,
          bike.servicesSelected,
          bike.notes,
          undefined,
          selectedDealposOrder.OrderID,
          flags,
          skuCodes
        );
      }
    }
    onClose();
    setSelectedDealposOrder(null);
    setBikesConfig([]);
  };

  const filteredDealposOrders = dealposOrders.filter((order: any) => {
    const query = dealposSearch.toLowerCase();
    const ignoredIdsSet = new Set(ignoredDealposIds || []);
    if (ignoredIdsSet.has(order.OrderID)) return false;
    return (
      (order.Customer || "").toLowerCase().includes(query) ||
      (order.ParkLabel || "").toLowerCase().includes(query) ||
      (order.Number || "").toLowerCase().includes(query)
    );
  });

  const dbjsVariantsCount = useMemo(() => {
    if (!selectedDealposOrder) return 0;
    let count = 0;
    selectedDealposOrder.Variants.forEach((v: any) => {
      const code = v.Code || "";
      const itemId = v.ItemID || "";
      if (code.startsWith("DBJS") || itemId.startsWith("DBJS")) {
        const qty = Number(v.Quantity || v.quantity || v.Qty || v.qty || 1);
        count += qty;
      }
    });
    return count;
  }, [selectedDealposOrder]);

  const activeBranchLabel = currentBranch === "pik" ? "PIK 2" : "Muara Karang";

  const toggleServiceForBike = (bikeId: number, serviceName: string) => {
    setBikesConfig((prev) =>
      prev.map((b) => {
        if (b.id !== bikeId) return b;
        const exist = b.servicesSelected.includes(serviceName);
        const newSvcs = exist
          ? b.servicesSelected.filter((s) => s !== serviceName)
          : [...b.servicesSelected, serviceName];
        return { ...b, servicesSelected: newSvcs };
      })
    );
  };

  return (
    <ModalBase 
      title={
        reconcilingTicket
          ? `Hubungkan ke DEALPOS (Rekonsiliasi)`
          : dealposStep === "manual" 
          ? "Buat Tiket Baru (Manual)" 
          : dealposStep === "configure-booking"
          ? "Konfigurasi Antrian"
          : `Tambah Pelanggan (${activeBranchLabel})`
      } 
      isOpen={isOpen} 
      onClose={onClose}
      maxWidth={reconcilingTicket ? "max-w-md" : dealposStep === "configure-booking" ? "max-w-2xl" : "max-w-lg"}
    >
      {reconcilingTicket ? (
        <div className="space-y-5">
          {/* Header Ticket Summary Card */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-slate-200 text-slate-800 px-2 py-0.5 rounded uppercase font-mono">
                #{reconcilingTicket.ticketNumber || reconcilingTicket.id.slice(-4)}
              </span>
              <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                {reconcilingTicket.customerName}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1">
              Model: {reconcilingTicket.unitSepeda} — Servis: {reconcilingTicket.serviceTypes.join(", ")}
            </p>
          </div>

          <div className="space-y-4">
            {/* OPTION A: Search & Dropdown for Open Parked Orders */}
            <div className="space-y-1.5 relative">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Opsi A: Cari & Pilih Tagihan Terbuka (Parked Order)</span>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Ketik nama / no. order atau klik dropdown..."
                  className="w-full p-2.5 pr-14 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-800 placeholder-slate-400"
                  value={recSearchQuery}
                  onChange={(e) => {
                    setRecSearchQuery(e.target.value);
                    setRecDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setRecDropdownOpen(true);
                    if (dealposOrders.length === 0) {
                      fetchDealposOrders();
                    }
                  }}
                />
                <div className="absolute right-2 flex items-center gap-1.5 z-10">
                  {recSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecSearchQuery("");
                        setRecSelectedOrderID(null);
                        setRecDropdownOpen(true);
                      }}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRecDropdownOpen(!recDropdownOpen);
                      if (!recDropdownOpen && dealposOrders.length === 0) {
                        fetchDealposOrders();
                      }
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Suggestions dropdown list */}
              {recDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setRecDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 z-50 max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg divide-y divide-slate-100 mt-1">
                    {(() => {
                      const isPreVal = recSearchQuery.startsWith("#");
                      const q = isPreVal ? "" : recSearchQuery.toLowerCase().trim();
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
                            setRecSelectedOrderID(o.OrderID);
                            setRecSearchQuery(`#${o.Number} - ${o.Customer || o.ParkLabel || "No Name"}`);
                            setRecDropdownOpen(false);
                            setRecInvoiceResult(null); // Clear Option B result
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

            {/* OPTION B: Search Invoice backup */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Opsi B: Cari No. Invoice (Final/Paid Backup)</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="No. Invoice (misal: 26.05.00347)..."
                  className="flex-1 p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-800 placeholder-slate-400"
                  value={recInvoiceInput}
                  onChange={(e) => setRecInvoiceInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleRecSearchInvoice}
                  disabled={!recInvoiceInput.trim() || recInvoiceResult?.loading}
                  className="px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center shrink-0 min-w-[70px]"
                >
                  {recInvoiceResult?.loading ? "..." : "Cari"}
                </button>
              </div>

              {recInvoiceResult && (
                <div className="text-[11px] font-bold p-3 rounded-xl border mt-1">
                  {recInvoiceResult.loading && (
                    <div className="text-slate-500 animate-pulse uppercase">🔍 SEDANG MENCARI INVOICE...</div>
                  )}
                  {recInvoiceResult.error && (
                    <div className="text-rose-600 uppercase">❌ {recInvoiceResult.error}</div>
                  )}
                  {recInvoiceResult.found && (
                    <div className="text-emerald-600 uppercase flex flex-col gap-0.5">
                      <span className="font-black">✅ INVOICE DITEMUKAN:</span>
                      <span className="text-slate-800 font-bold font-mono">No: #{recInvoiceResult.Number}</span>
                      <span className="text-slate-800 font-bold">Nama: {recInvoiceResult.CustomerName?.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action button container */}
          <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Batal
            </button>
            {recSelectedOrderID && (
              <button
                type="button"
                onClick={handleRecConnectSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shrink-0 active:scale-95 flex items-center gap-1.5"
              >
                <Check size={14} /> Hubungkan Kartu
              </button>
            )}
          </div>
        </div>
      ) : (
        <>

      {dealposStep === "fetch" && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-800 text-base uppercase tracking-wider">Menghubungkan DEALPOS</h4>
            <p className="text-sm text-slate-500 font-medium">Mengunduh daftar order aktif dari cabang {activeBranchLabel}...</p>
          </div>
        </div>
      )}

      {dealposStep === "select-order" && (
        <div className="flex flex-col space-y-4 overflow-hidden max-h-[75vh]">
          {dealposError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="shrink-0 text-red-500 mt-0.5" size={18} />
              <div className="text-xs">
                <p className="font-bold uppercase tracking-wider mb-0.5">Koneksi DEALPOS Bermasalah</p>
                <p className="opacity-90">{dealposError}</p>
                <button 
                  onClick={fetchDealposOrders}
                  className="mt-2 text-red-800 hover:text-red-900 font-black hover:underline uppercase tracking-wider flex items-center gap-1"
                >
                  Coba Sinkron Ulang
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari nama pelanggan / nomor order..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl outline-none font-medium text-sm focus:border-slate-300 transition-all font-sans"
                value={dealposSearch}
                onChange={(e) => setDealposSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setName("");
                setPhone("");
                setUnit("");
                setSelectedServices([]);
                setNotes("");
                setSelectedCustomer(null);
                setDealposStep("manual");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider shrink-0 transition-colors"
            >
              Mode Manual
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
            <h5 className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold pb-1">
              Daftar Pesanan DEALPOS yang dapat Diimpor ({filteredDealposOrders.length})
            </h5>
            {isLoadingDealpos ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500 text-sm font-bold">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                Menyinkronkan...
              </div>
            ) : filteredDealposOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <UserCog size={36} className="text-slate-300 mb-2 animate-pulse" />
                <p className="text-xs font-bold leading-relaxed px-4">Tidak ada pesanan parkir DEALPOS aktif dengan kode servis DBJS yang belum diimpor.</p>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                {filteredDealposOrders.map((order) => {
                  const dbjsList = order.Variants.filter((v: any) => {
                    const code = v.Code || "";
                    const itemId = v.ItemID || "";
                    return code.startsWith("DBJS") || itemId.startsWith("DBJS");
                  });

                  return (
                    <div 
                      key={order.OrderID}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:shadow-sm"
                      onClick={() => handleSelectOrder(order)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full tracking-wider uppercase">
                            #{order.Number}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {order.Created ? new Date(order.Created).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase">
                          {order.Customer || "Unknown"}
                        </h4>
                        {order.ParkLabel && (
                          <p className="text-xs text-slate-500 font-bold">
                            Label: {order.ParkLabel}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dbjsList.map((v: any, idx: number) => {
                            const qty = Number(v.Quantity || v.quantity || v.Qty || v.qty || 1);
                            const qtyDisplay = qty > 1 ? ` (x${qty})` : "";
                            return (
                              <span key={idx} className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-bold">
                                {v.Name}{qtyDisplay}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2 self-end sm:self-center">
                        {confirmIgnoreOrderId === order.OrderID ? (
                          <div className="bg-red-50 border border-red-200 p-2 rounded-xl flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-tight">Yakin sembunyikan order ini?</span>
                            <button
                              type="button"
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg tracking-wider transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onIgnoreDealposId) {
                                  onIgnoreDealposId(order.OrderID);
                                }
                                setDealposOrders(prev => prev.filter(o => o.OrderID !== order.OrderID));
                                setConfirmIgnoreOrderId(null);
                              }}
                            >
                              Ya
                            </button>
                            <button
                              type="button"
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg tracking-wider transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmIgnoreOrderId(null);
                              }}
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-black uppercase px-3 py-2 rounded-lg tracking-wider active:scale-95 transition-all text-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmIgnoreOrderId(order.OrderID);
                              }}
                            >
                              Bukan Service
                            </button>
                            <button 
                              className="bg-slate-900 hover:bg-black text-white text-xs font-black uppercase px-4 py-2 rounded-lg tracking-wider active:scale-95 transition-all text-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectOrder(order);
                              }}
                            >
                              Pilih
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {dealposStep === "configure-booking" && selectedDealposOrder && (
        <form onSubmit={handleConfirmDealposBooking} className="space-y-4 overflow-hidden max-h-[80vh] flex flex-col">
          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 shrink-0">
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Info Pelanggan & Pesanan</p>
                <p className="text-xs text-slate-500 font-bold mb-2 cursor-default">#{selectedDealposOrder.Number} - {selectedDealposOrder.ParkLabel}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Nama Pelanggan
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full text-xs font-bold text-slate-800 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                      value={dealposCustomerName}
                      onChange={(e) => setDealposCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Nomor Telepon <span className="text-red-500 font-black">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Contoh: 0812345678"
                      className="w-full text-xs font-bold text-slate-800 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                      value={dealposPhone}
                      onChange={(e) => setDealposPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {connectionMode === "new" && dbjsVariantsCount > 1 && (
              <div className="space-y-1 shrink-0 mt-1 sm:mt-0">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Jumlah Sepeda
                </label>
                <select 
                  className="w-full text-xs font-bold text-slate-800 p-2 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                  value={bikesConfig.length}
                  onChange={(e) => handleBikesCountChange(Number(e.target.value))}
                >
                  {Array.from({ length: dbjsVariantsCount }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {idx + 1} Sepeda
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Connection Mode Selection Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setConnectionMode("new")}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                connectionMode === "new"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Daftarkan Baru
            </button>
            <button
              type="button"
              onClick={() => setConnectionMode("connect")}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                connectionMode === "connect"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Hubungkan ke Antrian Manual
            </button>
          </div>

          {connectionMode === "new" ? (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pl-0.5">
              {bikesConfig.map((bike, idx) => {
                const orderDbjsServices = selectedDealposOrder.Variants.filter((v: any) => {
                  const code = v.Code || "";
                  const itemId = v.ItemID || "";
                  return code.startsWith("DBJS") || itemId.startsWith("DBJS");
                });

                return (
                  <div key={bike.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm relative">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h5 className="font-black text-sm text-slate-800 uppercase tracking-wider">
                        Spesifikasi Sepeda #{bike.id}
                      </h5>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-extrabold uppercase">
                        Sepeda {idx + 1} dari {bikesConfig.length}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                        Unit Sepeda (Wajib)
                      </label>
                      <input
                        required={connectionMode === "new"}
                        type="text"
                        placeholder="Contoh: Brompton M6L / Moots Vamoots"
                        className="w-full p-2.5 text-xs bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-bold placeholder:text-slate-400 placeholder:font-normal"
                        value={bike.unit}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBikesConfig(prev => prev.map(b => b.id === bike.id ? { ...b, unit: val } : b));
                        }}
                      />
                    </div>


                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                        Layanan Servis (Pilih satu/lebih)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {orderDbjsServices.map((v: any, index: number) => {
                          const isChecked = bike.servicesSelected.includes(v.Name);
                          return (
                            <button
                              type="button"
                              key={index}
                              onClick={() => toggleServiceForBike(bike.id, v.Name)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all select-none flex items-center gap-1.5 ${
                                isChecked
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {isChecked && <Check size={12} strokeWidth={3} />}
                              {v.Name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                        Catatan Keluhan / Instruksi Khusus
                      </label>
                      <textarea
                        placeholder="Masukkan keluhan khusus, cacat fisik awal, atau spesifikasi pengerjaan..."
                        className="w-full p-2.5 text-xs bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-medium h-16 resize-none placeholder:text-slate-400"
                        value={bike.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBikesConfig(prev => prev.map(b => b.id === bike.id ? { ...b, notes: val } : b));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pl-0.5">
              {activeManualTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl p-6">
                  <AlertCircle size={36} className="text-amber-500 mb-2" />
                  <p className="text-xs font-bold leading-relaxed">
                    Tidak ada Kartu Antrian berlabel "Manual Card" yang aktif saat ini di cabang ini.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-sm">
                    Buat kartu antrian manual terlebih dahulu agar bisa dihubungkan ke pesanan DEALPOS di sini.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm">
                  <div className="border-b border-slate-100 pb-2">
                    <h5 className="font-black text-sm text-slate-800 uppercase tracking-wider">
                      Pilih Antrian Manual
                    </h5>
                    <p className="text-xs text-slate-500 font-medium">
                      Pilih antrian mana yang ingin dihubungkan dengan pesanan DEALPOS ini
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Kartu Antrian Manual Aktif ({activeManualTickets.length})
                    </label>
                    <select
                      required={connectionMode === "connect"}
                      className="w-full text-xs font-bold text-slate-800 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-slate-300 transition-all cursor-pointer"
                      value={selectedManualTicketId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedManualTicketId(val);
                        if (val) {
                          const t = activeManualTickets.find((ticket: any) => ticket.id === val);
                          if (t) {
                            setDealposCustomerName(t.customerName || selectedDealposOrder?.Customer || "Unknown");
                            setDealposPhone(t.phone || selectedDealposOrder?.Phone || "");
                          }
                        }
                      }}
                    >
                      <option value="">-- Hubungkan ke Kartu Antrian Manual --</option>
                      {activeManualTickets.map((t: any) => {
                        const displayId = t.ticketNumber ? `#${t.ticketNumber}` : `#${t.id.slice(-4)}`;
                        return (
                          <option key={t.id} value={t.id}>
                            {displayId} - {t.customerName} | {t.unitSepeda} ({t.serviceTypes.join(", ")})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedManualTicketId && (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                          Nama Pelanggan (Ubah Jika Diperlukan)
                        </label>
                        <input
                          type="text"
                          className="w-full text-xs font-bold text-slate-800 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Masukkan nama pelanggan..."
                          value={dealposCustomerName}
                          onChange={(e) => setDealposCustomerName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                          Nomor Telepon (Wajib) <span className="text-red-500 font-black">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          className="w-full text-xs font-bold text-slate-800 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Masukkan nomor telepon..."
                          value={dealposPhone}
                          onChange={(e) => setDealposPhone(e.target.value.replace(/[^\d+]/g, ''))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={() => setDealposStep("select-order")}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest hover:underline"
            >
              Kembali
            </button>
            {connectionMode === "connect" ? (
              <button
                type="submit"
                disabled={activeManualTickets.length === 0 || !selectedManualTicketId || !dealposPhone.trim()}
                className="bg-slate-900 hover:bg-black text-white text-xs font-black uppercase px-6 py-3 rounded-lg tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow"
              >
                Hubungkan Pesanan DEALPOS
              </button>
            ) : (
              <button
                type="submit"
                disabled={!dealposPhone.trim() || bikesConfig.some(b => !b.unit.trim() || b.servicesSelected.length === 0)}
                className="bg-slate-900 hover:bg-black text-white text-xs font-black uppercase px-6 py-3 rounded-lg tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow"
              >
                Simpan & Daftarkan #{bikesConfig.length} Antrian
              </button>
            )}
          </div>
        </form>
      )}

      {dealposStep === "manual" && (
        <form onSubmit={handleManualSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <CustomerSearchInput
            customers={customers}
            onSelect={handleSelectCustomer}
            onClear={() => setSelectedCustomer(null)}
          />
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase">
              Detail Tiket
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
              Nama Pelanggan
            </label>
            <input
              required
              type="text"
              className={inputClass}
              placeholder="Contoh: Budi Prasetyo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
                Nomor Telepon <span className="text-red-500 font-black">*</span>
              </label>
              <input
                required
                type="text"
                className={inputClass}
                placeholder="08xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
                Unit Sepeda
              </label>
              {selectedCustomer &&
              selectedCustomer.bikes &&
              selectedCustomer.bikes.length > 0 ? (
                <div className="relative">
                  <input
                    type="text"
                    list="bike-options"
                    className={inputClass}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Pilih atau ketik baru..."
                  />
                  <datalist id="bike-options">
                    {selectedCustomer.bikes.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <input
                  required
                  type="text"
                  className={inputClass}
                  placeholder="Contoh: Brompton M6L"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
              Pilih Layanan
            </label>
            <MultiSearchableSelect
              options={serviceNames}
              selectedValues={selectedServices}
              onChange={setSelectedServices}
              placeholder="Pilih satu atau lebih layanan..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
              Catatan Keluhan
            </label>
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Sebutkan detail kerusakan jika ada..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => {
                setDealposStep("select-order");
                fetchDealposOrders();
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest hover:underline"
            >
              Gunakan DEALPOS
            </button>
            <button
              type="submit"
              disabled={!name || selectedServices.length === 0 || !unit}
              className="bg-slate-900 hover:bg-black text-white text-xs font-extrabold uppercase px-6 py-3.5 rounded-xl tracking-wider shadow transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            >
              Buat Tiket Antrian
            </button>
          </div>
        </form>
      )}
      </>)}
    </ModalBase>
  );
};
export const AssignMechanicModal = ({
  isOpen,
  onClose,
  ticket,
  mechanics,
  onAssign,
}: any) => {
  const [mechanic, setMechanic] = useState("");
  useEffect(() => {
    if (isOpen && mechanics && mechanics.length > 0) {
      setMechanic(mechanics[0].name);
    }
  }, [isOpen, mechanics]);
  return (
    <ModalBase title="Pilih Mekanik" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl text-center">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">
            Menugaskan untuk tiket
          </p>
          <p className="text-2xl font-black text-slate-800">#{ticket?.id}</p>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
            Nama Mekanik:
          </label>
          <select
            className="w-full p-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer"
            value={mechanic}
            onChange={(e) => setMechanic(e.target.value)}
          >
            {mechanics.map((m: any) => (
              <option
                key={m.id}
                value={m.name}
                className="bg-white text-slate-900"
              >
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            onAssign(ticket.id, mechanic);
            onClose();
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <UserCog size={20} /> Mulai Pengerjaan
        </button>
      </div>
    </ModalBase>
  );
};
export const PendingModal = ({ isOpen, onClose, ticket, onConfirm }: any) => {
  const reasons = [
    "Menunggu Sparepart",
    "Menunggu Persetujuan Pelanggan",
    "Istirahat / Ganti Shift",
  ];
  return (
    <ModalBase title="Tunda Pengerjaan" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-tight text-center">
          Pilih alasan penundaan:
        </p>
        {reasons.map((r) => (
          <button
            key={r}
            onClick={() => {
              onConfirm(ticket.id, r);
              onClose();
            }}
            className="w-full text-left p-5 bg-white border-2 border-slate-200 rounded-2xl hover:bg-orange-50 hover:border-orange-400 transition-all group active:scale-95 shadow-sm"
          >
            <span className="font-black text-slate-700 group-hover:text-orange-700 text-lg uppercase">
              {r}
            </span>
          </button>
        ))}
      </div>
    </ModalBase>
  );
};
export const CancelModal = ({ isOpen, onClose, ticket, onConfirm }: any) => {
  const [reason, setReason] = useState("");
  return (
    <ModalBase title="Batalkan Tiket" isOpen={isOpen} onClose={onClose}>
      <textarea
        required
        className="w-full p-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl mb-6 font-medium focus:ring-2 focus:ring-red-500 outline-none shadow-sm"
        rows={4}
        placeholder="Tuliskan alasan pembatalan tiket..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        disabled={!reason}
        onClick={() => {
          onConfirm(ticket.id, reason);
          onClose();
          setReason("");
        }}
        className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-30 active:scale-95"
      >
        Batalkan Tiket
      </button>
    </ModalBase>
  );
};
export const EditServicesModal = ({
  isOpen,
  onClose,
  ticket,
  services,
  onUpdate,
}: any) => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const serviceNames = useMemo(
    () => services.map((s: any) => s.name),
    [services],
  );
  useEffect(() => {
    if (ticket) {
      setSelectedServices(ticket.serviceTypes);
      setNotes(ticket.notes || "");
    }
  }, [ticket]);
  const handleSave = () => {
    if (ticket && selectedServices.length > 0) {
      onUpdate(ticket.id, selectedServices, notes);
      onClose();
    }
  };
  return (
    <ModalBase
      title={`Edit Layanan #${ticket?.id}`}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="text-xs font-bold text-slate-400 uppercase mb-1">
          Pelanggan
        </div>
        <div className="text-lg font-black text-slate-800">
          {ticket?.customerName}
        </div>
        <div className="text-sm text-slate-500 font-medium">
          {ticket?.unitSepeda}
        </div>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
            Daftar Layanan:
          </label>
          <MultiSearchableSelect
            options={serviceNames}
            selectedValues={selectedServices}
            onChange={setSelectedServices}
            placeholder="Pilih layanan..."
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
            Catatan:
          </label>
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Update catatan..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
        >
          Simpan Perubahan
        </button>
      </div>
    </ModalBase>
  );
};

// --- STORAGE MODALS ---

const MultiPhotoUpload = ({
  photos,
  onPhotosChange,
}: {
  photos: File[];
  onPhotosChange: (photos: File[]) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    // Generate object URLs for preview
    const newPreviews = photos.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);
    // Clean up object URLs to avoid memory leaks
    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      onPhotosChange([...photos, ...files]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = (Array.from(e.dataTransfer.files) as File[]).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) onPhotosChange([...photos, ...files]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-blue-100 transition-colors h-40 group"
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
        />
        <UploadCloud
          size={32}
          className="text-blue-500 mb-2 group-hover:scale-110 transition-transform"
        />
        <p className="text-sm font-bold text-blue-700">
          Click or Drag Photos Here
        </p>
        <p className="text-xs text-slate-400">Select multiple</p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group"
            >
              <img
                src={preview}
                alt={`Upload ${index}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(index);
                }}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`text-xs font-bold text-center text-slate-500`}>
        {photos.length} Photo(s) Selected (Optional)
      </div>
    </div>
  );
};

// Legacy Single Upload (Kept for Return logic)
const PhotoUpload = ({
  label,
  onPhotoSelect,
  required = false,
}: {
  label?: string;
  onPhotoSelect: (file: File) => void;
  required?: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      onPhotoSelect(file);
    }
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed ${preview ? "border-blue-400 bg-blue-50" : "border-slate-300"} rounded-xl p-2 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors h-32 relative overflow-hidden group`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      {preview ? (
        <img
          src={preview}
          alt="Preview"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <>
          <Camera
            size={24}
            className="group-hover:scale-110 transition-transform"
          />
          <span className="text-[10px] font-bold mt-2 uppercase text-center">
            {label || "Upload Foto"} {required && "*"}
          </span>
        </>
      )}
    </div>
  );
};

export const AdjustContractModal = ({
  isOpen,
  onClose,
  slot,
  onConfirm,
}: any) => {
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  useEffect(() => {
    if (slot) {
      if (slot.inDate) setNewStartDate(slot.inDate.split("T")[0]);
      if (slot.expiryDate) setNewEndDate(slot.expiryDate.split("T")[0]);
    }
  }, [slot]);

  return (
    <ModalBase title="Adjust Durasi Kontrak" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-4">
          <h3 className="font-bold text-slate-800">{slot?.customerName}</h3>
          <p className="text-sm text-slate-500">{slot?.bikeModel}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
              Tanggal Mulai
            </label>
            <input
              type="date"
              className={inputClass}
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">
              Tanggal Berakhir
            </label>
            <input
              type="date"
              className={inputClass}
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={() => {
            onConfirm(slot.id, newStartDate, newEndDate);
            onClose();
          }}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold uppercase shadow-lg mt-2"
        >
          Simpan Perubahan
        </button>
      </div>
    </ModalBase>
  );
};

export const StorageCheckInModal = ({
  isOpen,
  onClose,
  slotId,
  customers,
  onConfirm,
}: any) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bike, setBike] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().setDate(new Date().getDate() + 30))
      .toISOString()
      .split("T")[0],
  );
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Multi Photo Array
  const [photos, setPhotos] = useState<File[]>([]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    if (c.bikes.length === 1) setBike(c.bikes[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Removed photo requirement validation

    setIsSubmitting(true);
    const customerData: any = { name, phone, bikes: [bike] };
    if (selectedCustomer?.id) {
      customerData.id = selectedCustomer.id;
    }

    try {
      await onConfirm(customerData, bike, startDate, endDate, notes, photos);
      onClose();
      // Reset
      setName("");
      setPhone("");
      setBike("");
      setNotes("");
      setPhotos([]);
      setSelectedCustomer(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBase
      title={`Manual Check-In: ${slotId}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <CustomerSearchInput
          customers={customers}
          onSelect={handleSelectCustomer}
          onClear={() => setSelectedCustomer(null)}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Nama
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Telepon <span className="text-red-500 font-black">*</span>
            </label>
            <input
              required
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Sepeda
          </label>
          {selectedCustomer && selectedCustomer.bikes.length > 0 ? (
            <input
              list="bikes"
              required
              value={bike}
              onChange={(e) => setBike(e.target.value)}
              className={inputClass}
              placeholder="Pilih sepeda..."
            />
          ) : (
            <input
              required
              value={bike}
              onChange={(e) => setBike(e.target.value)}
              className={inputClass}
              placeholder="Model Sepeda"
            />
          )}
          {selectedCustomer && (
            <datalist id="bikes">
              {selectedCustomer.bikes.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Mulai Kontrak
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Selesai Kontrak
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            Foto Inspeksi (Opsional)
          </label>
          <MultiPhotoUpload photos={photos} onPhotosChange={setPhotos} />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Catatan
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            rows={2}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold uppercase shadow-lg text-center"
        >
          {isSubmitting ? "Uploading..." : "Simpan & Check-In"}
        </button>
      </form>
    </ModalBase>
  );
};

export const StorageActionModal = ({
  isOpen,
  onClose,
  slot,
  onRide,
  onCheckout,
  onViewHistory,
  onExtend,
}: any) => {
  const handleCopyId = () => {
    if (slot?.storageTicketId) {
      navigator.clipboard
        .writeText(slot.storageTicketId)
        .then(() => alert("ID Ticket Copied!"));
    }
  };

  return (
    <ModalBase
      title={`Menu Slot ${slot?.id}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="bg-slate-50 p-4 rounded-xl border mb-4 relative">
          <h3 className="font-bold text-lg">{slot?.customerName}</h3>
          <p className="text-slate-500">{slot?.bikeModel}</p>
          <p className="text-xs mt-2 text-slate-400">
            Exp: {new Date(slot?.expiryDate).toLocaleDateString()}
          </p>

          {/* Ticket ID Display */}
          {slot?.storageTicketId && (
            <div className="mt-3 flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
              <span className="text-xs font-bold text-slate-400 uppercase">
                ID:
              </span>
              <span className="font-mono font-black text-purple-600 text-sm flex-1">
                {slot.storageTicketId}
              </span>
              <button
                onClick={handleCopyId}
                className="text-slate-400 hover:text-purple-600 p-1"
                title="Copy ID for WA"
              >
                <Copy size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onRide();
              onClose();
            }}
            className="w-full p-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl font-black uppercase flex flex-col items-center justify-center gap-2 shadow-sm text-xs"
          >
            <Bike size={24} /> Unit Keluar
          </button>
          <button
            onClick={() => {
              onExtend();
              onClose();
            }}
            className="w-full p-4 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl font-black uppercase flex flex-col items-center justify-center gap-2 shadow-sm text-xs"
          >
            <PlusCircle size={24} /> Adjust Durasi Kontrak
          </button>
        </div>
        <button
          onClick={() => {
            onViewHistory();
            onClose();
          }}
          className="w-full p-4 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl font-black uppercase flex items-center justify-center gap-3 shadow-sm text-sm"
        >
          <History size={20} /> Riwayat / Log
        </button>
        <button
          onClick={() => {
            onCheckout();
            onClose();
          }}
          className="w-full p-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black uppercase flex items-center justify-center gap-3 shadow-sm text-sm"
        >
          <Check size={20} /> Selesai Kontrak (Checkout)
        </button>
      </div>
    </ModalBase>
  );
};

export const StorageReturnModal = ({
  isOpen,
  onClose,
  slot,
  onConfirm,
}: any) => {
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(photo, notes);
      onClose();
      setPhoto(null);
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBase title="Unit Kembali" isOpen={isOpen} onClose={onClose}>
      <div className="text-center space-y-6 py-4">
        <p className="text-slate-600">
          Konfirmasi unit <strong>{slot?.bikeModel}</strong> milik{" "}
          <strong>{slot?.customerName}</strong> telah kembali ke storage?
        </p>

        <div className="space-y-4">
          <PhotoUpload
            onPhotoSelect={setPhoto}
            label="Foto Kondisi (Optional)"
          />

          <div className="text-left">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Catatan Insiden / Kondisi
            </label>
            <textarea
              className={inputClass}
              placeholder="Catat jika ada lecet, kerusakan baru, atau insiden saat pemakaian..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold uppercase shadow-lg"
        >
          {isSubmitting ? "Uploading..." : "Konfirmasi Masuk"}
        </button>
      </div>
    </ModalBase>
  );
};
export const EditCustomerModal = ({
  isOpen,
  onClose,
  customer,
  onSave,
}: any) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bikes, setBikes] = useState<string[]>([]);
  const [newBike, setNewBike] = useState("");
  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
      setBikes(customer.bikes || []);
    }
  }, [customer]);
  const handleAddBike = () => {
    if (newBike && !bikes.includes(newBike)) {
      setBikes([...bikes, newBike]);
      setNewBike("");
    }
  };
  const removeBike = (bike: string) => {
    setBikes(bikes.filter((b) => b !== bike));
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(customer.id, name, phone, bikes);
    onClose();
  };
  return (
    <ModalBase title="Edit Data Pelanggan" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Nama
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Telepon <span className="text-red-500 font-black">*</span>
          </label>
          <input
            required
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
            Daftar Sepeda
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={newBike}
              onChange={(e) => setNewBike(e.target.value)}
              className={`${inputClass} py-2`}
              placeholder="Tambah sepeda..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddBike();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddBike}
              className="bg-slate-200 p-2 rounded-xl hover:bg-slate-300"
            >
              <Check size={20} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {bikes.map((b) => (
              <span
                key={b}
                className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-2"
              >
                {b}
                <X
                  size={12}
                  className="cursor-pointer hover:text-red-600"
                  onClick={() => removeBike(b)}
                />
              </span>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold uppercase shadow-lg mt-4"
        >
          Simpan Perubahan
        </button>
      </form>
    </ModalBase>
  );
};

// --- HISTORY MODAL (Updated for Gallery View) ---
export const StorageHistoryModal = ({
  isOpen,
  onClose,
  slot,
}: {
  isOpen: boolean;
  onClose: () => void;
  slot: StorageSlot | null;
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <ModalBase
      title={`Riwayat Slot ${slot?.id}`}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {!slot?.history || slot.history.length === 0 ? (
          <p className="text-center text-slate-500 italic">
            Belum ada riwayat.
          </p>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
            {slot.history
              .slice()
              .reverse()
              .map((log: StorageLog) => {
                // Helper to extract photos from log in legacy or new format
                let logPhotos: string[] = log.photos || [];
                // Fallback to legacy single photo if necessary
                if ((log as any).photo && logPhotos.length === 0) logPhotos = [(log as any).photo];

                return (
                  <div key={log.id} className="ml-6 relative">
                    <div
                      className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${log.action === "check_in" ? "bg-purple-500" : log.action === "ride_out" ? "bg-yellow-500" : log.action === "ride_return" ? "bg-green-500" : log.action === "extend" ? "bg-blue-500" : "bg-slate-500"}`}
                    ></div>
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-slate-400 font-mono mb-1">
                        {formatTime(log.timestamp)}
                      </div>
                      <div
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${log.action === "check_in" ? "bg-purple-100 text-purple-700" : log.action === "ride_out" ? "bg-yellow-100 text-yellow-700" : log.action === "ride_return" ? "bg-green-100 text-green-700" : log.action === "extend" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}
                      >
                        {log.action.replace("_", " ")}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                      {log.notes && (
                        <p className="text-sm text-slate-700 italic mb-2">
                          "{log.notes}"
                        </p>
                      )}
                      {logPhotos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {logPhotos.map((photo, pIndex) => (
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
                );
              })}
          </div>
        )}
      </div>

      {/* Image Preview Overlay */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Full View"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button className="absolute top-4 right-4 text-white hover:text-slate-300">
            <X size={32} />
          </button>
        </div>
      )}
    </ModalBase>
  );
};

export const StorageApprovalModal = ({
  isOpen,
  onClose,
  request,
  slotId,
  onConfirm,
}: any) => {
  // Editable States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bikeModel, setBikeModel] = useState("");

  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (request) {
      setName(request.name);
      setPhone(request.phone);
      setBikeModel(request.bikeModel);
      setNotes(request.notes || "");

      const start = new Date();
      setStartDate(start.toISOString().split("T")[0]);

      const end = new Date(start);
      end.setMonth(end.getMonth() + (request.durationMonths || 1));
      setEndDate(end.toISOString().split("T")[0]);
    }
  }, [request]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(request.id, slotId, {
        name: name,
        phone: phone,
        bikeModel: bikeModel,
        startDate,
        endDate,
        notes,
        photos: photos,
      });
      onClose();
      setPhotos([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBase
      title={`Approve Request into ${slotId}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-2">
          <p className="text-xs font-bold text-purple-700 uppercase mb-2">
            Konfirmasi Data Pelanggan
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Nama
              </label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Telepon <span className="text-red-500 font-black">*</span>
              </label>
              <input
                required
                type="text"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Model Sepeda
              </label>
              <input
                className={inputClass}
                value={bikeModel}
                onChange={(e) => setBikeModel(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Mulai
            </label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Selesai
            </label>
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            Foto Inspeksi (Opsional)
          </label>
          <MultiPhotoUpload photos={photos} onPhotosChange={setPhotos} />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
            Catatan Tambahan
          </label>
          <textarea
            className={inputClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold uppercase shadow-lg"
        >
          {isSubmitting ? "Uploading..." : "Setujui & Masuk Slot"}
        </button>
      </div>
    </ModalBase>
  );
};

export const PhotoGuidanceModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  return (
    <ModalBase title="Panduan Foto Inspeksi" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-600">
        <p>
          Untuk memastikan kondisi sepeda tercatat dengan baik, mohon ambil foto
          dengan ketentuan berikut:
        </p>
        <div className="space-y-3">
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <strong className="block text-slate-800 mb-1">
              1. Frame (Sisi Kanan)
            </strong>
            <p>
              Ambil foto seluruh sepeda dari sisi kanan (drive side). Pastikan
              pencahayaan cukup agar goresan terlihat jika ada.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <strong className="block text-slate-800 mb-1">
              2. Groupset / Drivetrain
            </strong>
            <p>
              Foto close-up pada bagian RD, Crank, dan Rantai untuk melihat
              kebersihan dan kondisi fisik.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <strong className="block text-slate-800 mb-1">
              3. Wheelset & Ban
            </strong>
            <p>Foto kondisi rim (brake line jika rim brake) dan kondisi ban.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-black text-white py-3 rounded-xl font-bold uppercase mt-2 shadow-lg transition-all"
        >
          Saya Mengerti
        </button>
      </div>
    </ModalBase>
  );
};

export const ConfirmationModal = ({
  isOpen,
  title,
  message,
  confirmText = "Konfirmasi",
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  return (
    <ModalBase
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="space-y-6 text-center py-2">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-500 border-4 border-red-100">
          <AlertCircle size={32} />
        </div>
        <p className="text-slate-600 font-medium px-4">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold uppercase transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold uppercase shadow-lg transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ModalBase>
  );
};

export const KendalaModal = ({ isOpen, onClose, ticket, services, onConfirm }: any) => {
  const [kendala, setKendala] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const serviceNames = useMemo(
    () => services.map((s: any) => s.name),
    [services],
  );

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setKendala("");
      setSelectedServices([]);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kendala.trim() || selectedServices.length === 0) {
      alert("Harap isi catatan kendala dan pilih setidaknya 1 layanan.");
      return;
    }
    // format the note
    const garansiNotes = `[GARANSI] - Kendala: ${kendala}`;
    onConfirm(ticket, garansiNotes, selectedServices);
    onClose();
  };

  return (
    <ModalBase isOpen={isOpen} title={`Kendala: ${ticket?.customerName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-yellow-50 text-yellow-700 text-sm p-3 rounded border border-yellow-200">
          <strong>Perhatian:</strong> Membuat tiket dari form ini akan membuat antrian baru bertanda <span className="font-bold uppercase tracking-wide bg-red-500 text-white px-1 rounded text-xs ml-1 mr-1">Garansi</span> di daftar "Menunggu". Tiket yang lama akan ditandai selesai.
        </div>
        
        <div>
          <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-2">
            Pilih Layanan Garansi <span className="text-red-500">*</span>
          </label>
          <MultiSearchableSelect
            options={serviceNames}
            selectedValues={selectedServices}
            onChange={setSelectedServices}
            placeholder="Pilih satu atau lebih layanan..."
          />
        </div>

        <div>
          <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-2">
            Catatan Kendala <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={kendala}
            onChange={(e) => setKendala(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white text-sm min-h-[100px]"
            placeholder="Contoh: Rem masih blong, ban kempes..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-black uppercase tracking-widest transition-colors shadow-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-black uppercase tracking-widest shadow-lg transition-transform active:scale-95"
          >
            Buat Tiket Antrian
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

export const FollowUpModal = ({ isOpen, onClose, ticket, onConfirm }: any) => {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'Selesai' | 'Kendala' | 'Tidak Respond' | 'Milik Internal'>("Selesai");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhoto(null);
      setPreview(null);
      setIsUploading(false);
      setSelectedOutcome("Selesai");
    }

    const globalPaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) setFile(file);
        }
      }
    };

    window.addEventListener("paste", globalPaste);
    return () => window.removeEventListener("paste", globalPaste);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  };

  const setFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang diperbolehkan.");
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) setFile(file);
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;

    if (selectedOutcome === "Milik Internal") {
      setIsUploading(true);
      try {
        onConfirm(ticket, "Milik Internal");
        onClose();
      } catch (err) {
        console.error(err);
        alert("Terjadi kesalahan.");
      } finally {
        setIsUploading(false);
      }
    } else {
      if (!photo) return;
      setIsUploading(true);
      try {
        const url = await uploadFollowUpScreenshot(ticket, photo);
        if (url) {
          onConfirm(ticket, selectedOutcome, url);
          onClose();
        } else {
          alert("Gagal mengunggah foto. Silakan coba lagi.");
        }
      } catch (err) {
        console.error(err);
        alert("Terjadi kesalahan saat mengunggah.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const isSubmitDisabled = selectedOutcome !== "Milik Internal" && !photo;

  return (
    <ModalBase isOpen={isOpen} title="Follow Up Manajemen" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* WhatsApp Redirection Button */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2.5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Hubungi Pelanggan
          </p>
          <button
            type="button"
            onClick={() => {
              const cleanPhone = ticket
                ? ticket.phone.startsWith("0")
                  ? "62" + ticket.phone.slice(1)
                  : ticket.phone
                : "";
              window.open(`https://wa.me/${cleanPhone}`, "_blank");
            }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-black text-xs py-3 rounded-xl shadow-sm transition-all uppercase tracking-widest"
          >
            📲 Follow Up WA
          </button>
        </div>

        {/* Outcome Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
            Pilih Hasil Follow Up
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "Selesai", label: "Selesai", icon: "✅", desc: "Instruksi pengerjaan selesai" },
              { id: "Kendala", label: "Kendala", icon: "⚠️", desc: "Terdapat kendala pengerjaan" },
              { id: "Tidak Respond", label: "Tidak Respond", icon: "⏳", desc: "Pelanggan tidak merespon" },
              { id: "Milik Internal", label: "Milik Internal", icon: "🏢", desc: "Sepeda milik tim/toko" },
            ].map((opt) => {
              const isSelected = selectedOutcome === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedOutcome(opt.id as any)}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    isSelected
                      ? "bg-slate-950 text-white border-slate-950 shadow-md ring-1 ring-slate-950"
                      : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </div>
                  <span className={`text-[10px] font-medium leading-tight ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conditional Screenshot Upload UI */}
        {selectedOutcome !== "Milik Internal" ? (
          <div className="space-y-3">
            <div className="bg-purple-50 text-purple-800 text-xs p-3.5 rounded-xl border border-purple-200/50 flex items-start gap-2.5">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-purple-600" />
              <p className="font-semibold leading-relaxed">
                Wajib melampirkan <strong>Screenshot chat WhatsApp</strong> sebagai bukti hasil follow up ({selectedOutcome}).
              </p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onPaste={onPaste}
              onClick={() => fileInputRef.current?.click()}
              className={`relative group border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[160px] ${
                preview ? 'border-purple-500 bg-purple-50/30' : 'border-slate-200 hover:border-purple-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {preview ? (
                <div className="relative w-full aspect-video max-h-[180px] rounded-xl overflow-hidden shadow-sm">
                  <img src={preview} alt="Preview Screenshot" className="w-full h-full object-contain bg-black/5" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                      <UploadCloud size={16} /> Klik/Drag untuk ganti
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-2 group-hover:scale-110 transition-transform">
                    <UploadCloud size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-800 font-extrabold uppercase tracking-wider text-xs mb-0.5">
                      Upload Screenshot Chat WA
                    </p>
                    <p className="text-slate-500 text-[10px] font-medium leading-relaxed">
                      Klik, Drag & Drop, atau <strong>Paste (Ctrl+V)</strong> di sini
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-xl border border-blue-200/50 flex items-start gap-2.5">
            <span className="text-base">🏢</span>
            <p className="font-semibold leading-relaxed">
              Hasil <strong>Milik Internal</strong> teridentifikasi sebagai keperluan operasional tim/toko sendiri, sehingga <strong>tidak membutuhkan bukti screenshot</strong>.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled || isUploading}
            className={`flex-1 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
              isSubmitDisabled || isUploading
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-black active:scale-[0.98]"
            }`}
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {isUploading ? "Mengunggah..." : "Simpan Selesai"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

