
import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  runTransaction, 
  writeBatch, 
  getDocs,
  orderBy,
  where,
  limit,
  arrayUnion
} from 'firebase/firestore';
import { Ticket, MechanicDefinition, ServiceDefinition, TicketStatus, Branch, Customer, StorageSlot, StorageLog } from "../types";
import { DEFAULT_MECHANICS, DEFAULT_SERVICES } from "../constants";

// --- HELPERS ---

// Map Firestore snapshot to typed array
const mapSnapshot = <T>(snapshot: any) => {
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as T[];
};

// Batch delete helper
const deleteCollection = async (collectionName: string) => {
  const q = query(collection(db, collectionName));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

// --- SUBSCRIPTIONS (REAL-TIME) ---

export const subscribeToTickets = (onUpdate: (tickets: Ticket[]) => void) => {
    // Order by arrival time descending
    const q = query(collection(db, 'tickets'));
    return onSnapshot(q, (snapshot) => {
        const tickets = mapSnapshot<Ticket>(snapshot);
        // Client-side sort to ensure correct date handling
        tickets.sort((a,b) => new Date(b.timestamps.arrival).getTime() - new Date(a.timestamps.arrival).getTime());
        onUpdate(tickets);
    }, (err) => console.error("Ticket Sync Error:", err));
};

export const subscribeToMechanics = (onUpdate: (mechanics: MechanicDefinition[]) => void) => {
    const q = query(collection(db, 'mechanics'));
    return onSnapshot(q, (snapshot) => {
        const data = mapSnapshot<MechanicDefinition>(snapshot);
        if (data.length === 0) {
            // Seed defaults if empty
            const batch = writeBatch(db);
            DEFAULT_MECHANICS.forEach(m => {
                const ref = doc(db, 'mechanics', m.id);
                batch.set(ref, m);
            });
            batch.commit();
        } else {
            onUpdate(data);
        }
    });
};

export const subscribeToServices = (onUpdate: (services: ServiceDefinition[]) => void) => {
    const q = query(collection(db, 'services'));
    return onSnapshot(q, (snapshot) => {
        const data = mapSnapshot<ServiceDefinition>(snapshot);
        if (data.length === 0) {
            // Seed defaults if empty
            const batch = writeBatch(db);
            DEFAULT_SERVICES.forEach(s => {
                const ref = doc(db, 'services', s.id);
                batch.set(ref, s);
            });
            batch.commit();
        } else {
            onUpdate(data);
        }
    });
};

export const subscribeToCustomers = (onUpdate: (customers: Customer[]) => void) => {
    const q = query(collection(db, 'customers'));
    return onSnapshot(q, (snapshot) => {
        const customers = mapSnapshot<Customer>(snapshot);
        customers.sort((a,b) => a.name.localeCompare(b.name));
        onUpdate(customers);
    });
};

export const subscribeToStorage = (onUpdate: (slots: StorageSlot[]) => void) => {
    const q = query(collection(db, 'storageSlots'));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            initializeStorageSlots();
        } else {
            const slots = mapSnapshot<StorageSlot>(snapshot);
            // Sort naturally by ID (A-01, A-02...)
            slots.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
            onUpdate(slots);
        }
    });
};

// --- ACTIONS ---

export const initializeStorageSlots = async () => {
    // Check if exists first to avoid race conditions
    const q = query(collection(db, 'storageSlots'));
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const batch = writeBatch(db);
    for (let i = 1; i <= 30; i++) {
        const id = `A-${String(i).padStart(2, '0')}`;
        const ref = doc(db, 'storageSlots', id);
        batch.set(ref, {
            id,
            status: 'vacant',
            lastActivity: new Date().toISOString(),
            history: []
        });
    }
    await batch.commit();
};

export const addTicketToCloud = async (
  branch: Branch,
  customerName: string,
  phone: string,
  unitSepeda: string,
  serviceTypes: string[],
  notes: string,
  customerId?: string
) => {
    // 1. Prepare Identifiers
    const uniqueDocId = `T-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // 2. Prepare Customer Logic (Deduplication)
    let finalCustomerId = customerId;
    let newCustomerData: any = null;
    let customerToUpdate: { id: string, bikes: string[] } | null = null;

    if (!finalCustomerId) {
        // Attempt to find existing customer by PHONE
        try {
            const q = query(collection(db, 'customers'), where('phone', '==', phone));
            const querySnapshot = await getDocs(q);
            
            // Check for name match (case-insensitive)
            const match = querySnapshot.docs.find(d => d.data().name.trim().toLowerCase() === customerName.trim().toLowerCase());

            if (match) {
                finalCustomerId = match.id;
                const currentBikes = match.data().bikes || [];
                if (!currentBikes.includes(unitSepeda)) {
                    customerToUpdate = { id: match.id, bikes: [...currentBikes, unitSepeda] };
                }
            } else {
                // Create New
                finalCustomerId = 'CUST-' + Date.now();
                newCustomerData = {
                    id: finalCustomerId,
                    name: customerName,
                    phone: phone,
                    bikes: [unitSepeda]
                };
            }
        } catch (err) {
            console.error("Error searching customer, defaulting to new", err);
            finalCustomerId = 'CUST-' + Date.now();
            newCustomerData = {
                id: finalCustomerId,
                name: customerName,
                phone: phone,
                bikes: [unitSepeda]
            };
        }
    } else {
        // ID Provided, check if we need to add bike (we'll do this optimistically in transaction)
    }

    // 3. Prepare Ticket Data
    const newTicketData = {
        id: uniqueDocId,
        branch,
        customerName,
        phone,
        unitSepeda,
        serviceTypes,
        mechanic: null,
        status: 'waiting',
        notes,
        timestamps: {
            arrival: timestamp,
            called: null,
            ready: null,
            finished: null
        }
    };

    try {
        await runTransaction(db, async (transaction) => {
            // A. Handle Ticket Counter
            const counterRef = doc(db, 'settings', 'ticketCounter');
            const counterDoc = await transaction.get(counterRef);
            
            let nextNum = 1;
            if (counterDoc.exists()) {
                nextNum = (counterDoc.data().current || 0) + 1;
            }
            transaction.set(counterRef, { current: nextNum }, { merge: true });

            // B. Handle Customer
            if (newCustomerData) {
                transaction.set(doc(db, 'customers', finalCustomerId!), newCustomerData);
            } else if (customerToUpdate) {
                transaction.update(doc(db, 'customers', customerToUpdate.id), { bikes: customerToUpdate.bikes });
            } else if (customerId) {
                // If explicit ID was passed, double check bike array
                const cRef = doc(db, 'customers', customerId);
                const cDoc = await transaction.get(cRef);
                if (cDoc.exists()) {
                    const bikes = cDoc.data().bikes || [];
                    if (!bikes.includes(unitSepeda)) {
                        transaction.update(cRef, { bikes: [...bikes, unitSepeda] });
                    }
                }
            }

            // C. Create Ticket
            const ticketRef = doc(db, 'tickets', uniqueDocId);
            transaction.set(ticketRef, {
                ...newTicketData,
                ticketNumber: nextNum.toString()
            });
        });
    } catch (e) {
        console.error("Transaction failed, attempting fallback...", e);
        
        // FALLBACK: If transaction fails (locked resource, offline), use "Last Ticket + 1" heuristic
        // This prevents the "random number" issue by guessing the next number reasonably well.
        try {
            const q = query(collection(db, 'tickets'), orderBy('timestamps.arrival', 'desc'), limit(1));
            const snap = await getDocs(q);
            let nextNum = 1;
            
            if (!snap.empty) {
                const lastData = snap.docs[0].data();
                if (lastData.ticketNumber) {
                    const parsed = parseInt(lastData.ticketNumber);
                    if (!isNaN(parsed)) nextNum = parsed + 1;
                }
            }

            // Force update counter if possible, ignoring concurrency
            setDoc(doc(db, 'settings', 'ticketCounter'), { current: nextNum }, { merge: true }).catch(() => {});

            // Save Customer
            if (newCustomerData) {
                 await setDoc(doc(db, 'customers', finalCustomerId!), newCustomerData);
            } else if (customerToUpdate) {
                 await updateDoc(doc(db, 'customers', customerToUpdate.id), { bikes: customerToUpdate.bikes });
            } else if (customerId) {
                 // UPDATED: Ensure bike is added even in fallback mode if ID provided
                 await updateDoc(doc(db, 'customers', customerId), {
                     bikes: arrayUnion(unitSepeda)
                 });
            }

            // Save Ticket
            await setDoc(doc(db, 'tickets', uniqueDocId), {
                ...newTicketData,
                ticketNumber: nextNum.toString()
            });

        } catch (innerError) {
             console.error("Fallback failed", innerError);
             alert("Gagal menyimpan tiket. Cek koneksi internet.");
        }
    }
};

export const updateTicketStatusInCloud = async (
  id: string, 
  currentTicket: Ticket, 
  status: TicketStatus, 
  mechanic?: string, 
  notes?: string, 
  reason?: string
) => {
    const ref = doc(db, 'tickets', id);
    const updates: any = { status };

    // Timestamp logic
    if (status === 'active' && currentTicket.status === 'waiting') updates['timestamps.called'] = new Date().toISOString();
    if (status === 'ready') updates['timestamps.ready'] = new Date().toISOString();
    if (status === 'done') updates['timestamps.finished'] = new Date().toISOString();

    if (mechanic !== undefined) updates.mechanic = mechanic;
    if (reason !== undefined) updates.cancellationReason = reason;

    // Notes logic
    if (notes !== undefined) {
        if (status === 'pending' && currentTicket.notes) {
            const timestamp = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
            updates.notes = `${currentTicket.notes} | [${timestamp}] ${notes}`;
        } else {
            updates.notes = notes;
        }
    }

    await updateDoc(ref, updates);
};

export const updateTicketServicesInCloud = async (id: string, serviceTypes: string[], notes?: string) => {
    const ref = doc(db, 'tickets', id);
    const updates: any = { serviceTypes };
    if (notes !== undefined) updates.notes = notes;
    await updateDoc(ref, updates);
};

// --- CUSTOMER ACTIONS ---

export const updateCustomerInCloud = async (id: string, name: string, phone: string, bikes: string[]) => {
    const ref = doc(db, 'customers', id);
    await updateDoc(ref, { name, phone, bikes });
};

export const removeCustomerFromCloud = async (id: string) => {
    await deleteDoc(doc(db, 'customers', id));
};

// --- STORAGE ACTIONS ---

export const updateStorageSlot = async (
    slotId: string, 
    updates: Partial<StorageSlot>, 
    logAction?: 'ride_out' | 'ride_return' | 'checkout',
    logPhoto?: string
) => {
    const ref = doc(db, 'storageSlots', slotId);
    
    // We can't easily arrayUnion a complex object with generated ID without reading first.
    // So we assume we just fetch and update.
    await runTransaction(db, async (transaction) => {
        const slotDoc = await transaction.get(ref);
        if (!slotDoc.exists()) return;

        const data = slotDoc.data() as StorageSlot;
        const history = data.history || [];

        // Apply updates
        const newUpdates = { 
            ...updates, 
            lastActivity: new Date().toISOString() 
        };

        // Add Log
        let newHistory = history;
        if (logAction) {
            const log: StorageLog = {
                id: Date.now().toString(),
                action: logAction,
                timestamp: new Date().toISOString(),
                notes: updates.notes,
                photo: logPhoto
            };
            newHistory = [...history, log];
        }

        transaction.update(ref, { ...newUpdates, history: newHistory });
    });
};

export const checkInStorage = async (
  slotId: string, 
  customer: Customer | { name: string, phone: string, bikes: string[] },
  bikeModel: string,
  startDate: string,
  endDate: string,
  notes: string,
  photo?: string
) => {
    const inDate = new Date(startDate).toISOString();
    const expiryDate = new Date(endDate).toISOString();
    const timestamp = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
        // 1. Handle Customer
        let customerId: string;
        if ('id' in customer) {
             customerId = customer.id;
             // Update customer bikes if needed
             const custRef = doc(db, 'customers', customerId);
             const custDoc = await transaction.get(custRef);
             if (custDoc.exists()) {
                 const existingBikes = custDoc.data().bikes || [];
                 if (!existingBikes.includes(bikeModel)) {
                     transaction.update(custRef, { bikes: [...existingBikes, bikeModel] });
                 }
             }
        } else {
             customerId = 'CUST-' + Date.now();
             const newCustRef = doc(db, 'customers', customerId);
             transaction.set(newCustRef, {
                 id: customerId,
                 name: customer.name,
                 phone: customer.phone,
                 bikes: [bikeModel]
             });
        }

        // 2. Update Slot
        const slotRef = doc(db, 'storageSlots', slotId);
        const log: StorageLog = {
            id: Date.now().toString(),
            action: 'check_in',
            timestamp: inDate,
            notes: notes,
            photo: photo
        };

        transaction.update(slotRef, {
            status: 'occupied',
            customerId,
            customerName: customer.name,
            customerPhone: customer.phone,
            bikeModel,
            inDate,
            expiryDate,
            notes,
            lastActivity: inDate,
            history: [log] // Reset history for new check in
        });
    });
};

// --- SETTINGS (MASTER DATA) ---

export const addMechanicToCloud = async (name: string, branches: Branch[]) => {
    const id = 'MECH-' + Date.now();
    await setDoc(doc(db, 'mechanics', id), { id, name, branches });
};

export const updateMechanicInCloud = async (id: string, name: string, branches: Branch[]) => {
    await updateDoc(doc(db, 'mechanics', id), { name, branches });
};

export const removeMechanicFromCloud = async (id: string) => {
    await deleteDoc(doc(db, 'mechanics', id));
};

export const addServiceToCloud = async (name: string, branches: Branch[]) => {
    const id = 'SVC-' + Date.now();
    await setDoc(doc(db, 'services', id), { id, name, branches });
};

export const updateServiceInCloud = async (id: string, name: string, branches: Branch[]) => {
    await updateDoc(doc(db, 'services', id), { name, branches });
};

export const removeServiceFromCloud = async (id: string) => {
    await deleteDoc(doc(db, 'services', id));
};

export const resetDatabase = async () => wipeDatabase();

export const wipeDatabase = async () => {
    if (!window.confirm("PERINGATAN: Ini akan menghapus SEMUA Data (Tiket, Pelanggan, Storage) dari DATABASE ONLINE. Data Master tetap ada. Lanjutkan?")) return;
    
    try {
        await deleteCollection('tickets');
        await deleteCollection('customers');
        // Reset Storage Slots to Vacant (don't delete, just reset fields)
        const q = query(collection(db, 'storageSlots'));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
            batch.set(d.ref, {
                id: d.id,
                status: 'vacant',
                lastActivity: new Date().toISOString(),
                history: []
            });
        });
        await batch.commit();

        // Reset Counter
        await setDoc(doc(db, 'settings', 'ticketCounter'), { current: 0 });

        alert("Database berhasil di-reset.");
        window.location.reload();
    } catch (e) {
        console.error("Wipe failed", e);
        alert("Gagal mereset database. Pastikan Anda memiliki hak akses.");
    }
};

export const resetTicketNumber = async () => {
     if (!window.confirm("PERINGATAN: Ini akan mereset nomor antrian kembali ke 1. Pastikan tidak ada tiket aktif dengan nomor kecil. Lanjutkan?")) return;
     try {
         await setDoc(doc(db, 'settings', 'ticketCounter'), { current: 0 });
         alert("Nomor tiket berhasil direset ke 0.");
     } catch (e) {
         console.error("Reset counter failed", e);
         alert("Gagal mereset counter.");
     }
};

// --- HELPERS ---
export const formatTime = (isoString: string | null): string => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).replace(',', '');
};

export const calculateWaitTime = (arrival: string, called: string | null): string => {
  if (!called) return '-';
  const diffMs = new Date(called).getTime() - new Date(arrival).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  return `${diffMins} min`;
};
