
import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  deleteField,
  onSnapshot, 
  query, 
  writeBatch, 
  getDocs,
  getDoc,
  runTransaction,
  where
} from 'firebase/firestore';

import { Ticket, MechanicDefinition, ServiceDefinition, TicketStatus, Branch, Customer, StorageSlot, StorageLog, StorageRequest } from "../types";
import { DEFAULT_MECHANICS, DEFAULT_SERVICES } from "../constants";

// --- HELPER: SEED FIRESTORE DEFAULTS ---
const seedFirestoreDefaults = async () => {
    if (!db) return;
    
    try {
        const servicesSnap = await getDocs(collection(db, 'services'));
        if (servicesSnap.empty) {
            const batch = writeBatch(db);
            DEFAULT_SERVICES.forEach(s => batch.set(doc(db, 'services', s.id), s));
            await batch.commit();
            console.log("Seeded Services");
        }

        const mechanicsSnap = await getDocs(collection(db, 'mechanics'));
        if (mechanicsSnap.empty) {
            const batch = writeBatch(db);
            DEFAULT_MECHANICS.forEach(m => batch.set(doc(db, 'mechanics', m.id), m));
            await batch.commit();
            console.log("Seeded Mechanics");
        }
    } catch (e) {
        console.error("Error seeding defaults:", e);
    }
};

// --- HELPER: SANITIZE FOR FIRESTORE ---
const sanitizePayload = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value === undefined) return null;
        return value;
    }));
};

// --- SUBSCRIPTIONS ---

export const subscribeToTickets = (onUpdate: (tickets: Ticket[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'tickets'));
    return onSnapshot(q, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
        tickets.sort((a,b) => new Date(b.timestamps.arrival).getTime() - new Date(a.timestamps.arrival).getTime());
        onUpdate(tickets);
    }, (error) => console.error("Ticket subscription error:", error));
};

export const subscribeToMechanics = (onUpdate: (mechanics: MechanicDefinition[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'mechanics'));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MechanicDefinition));
        if (data.length === 0) seedFirestoreDefaults();
        else onUpdate(data);
    });
};

export const subscribeToServices = (onUpdate: (services: ServiceDefinition[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'services'));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceDefinition));
        if (data.length === 0) seedFirestoreDefaults();
        else onUpdate(data);
    });
};

export const subscribeToCustomers = (onUpdate: (customers: Customer[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'customers'));
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || '',
                    phone: data.phone || '',
                    bikes: Array.isArray(data.bikes) ? data.bikes : [] 
                } as Customer;
        });
        customers.sort((a,b) => a.name.localeCompare(b.name));
        onUpdate(customers);
    });
};

export const subscribeToStorage = (onUpdate: (slots: StorageSlot[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'storageSlots'));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            initializeStorageSlots();
        } else {
            const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StorageSlot));
            slots.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
            onUpdate(slots);
        }
    });
};

export const subscribeToStorageRequests = (onUpdate: (requests: StorageRequest[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'storageRequests'), where('status', '==', 'pending'));
    return onSnapshot(q, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StorageRequest));
        reqs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        onUpdate(reqs);
    });
};

// --- ACTIONS ---

export const initializeStorageSlots = async () => {
    if (!db) return;
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
    if (!db) return;
    const uniqueDocId = `T-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const cleanName = customerName.trim();
    const cleanPhone = phone.trim();
    const cleanUnit = unitSepeda.trim();

    try {
        await runTransaction(db, async (transaction) => {
            // === 1. PREPARE REFS & DETERMINE ID ===
            const configRef = doc(db, 'settings', 'config');
            const ticketRef = doc(db, 'tickets', uniqueDocId);
            
            // Determine Customer Ref & ID outside getting
            let finalCustomerId = customerId;
            let custRef;

            if (finalCustomerId) {
                custRef = doc(db, 'customers', finalCustomerId);
            } else {
                custRef = doc(collection(db, 'customers')); // New Doc
                finalCustomerId = custRef.id;
            }

            // === 2. EXECUTE ALL READS FIRST ===
            const configDoc = await transaction.get(configRef);
            
            // We must try to read customer doc even if we think it's new (to be safe or if logic changes),
            // but for transaction efficiency: if we generated a new ID locally (custRef.id), 
            // the doc definitely doesn't exist yet in cloud unless ID collision (negligible).
            // However, to satisfy "All reads before writes", we read it if we have an ID passed in.
            let custDoc = null;
            if (customerId) {
                custDoc = await transaction.get(custRef);
            }

            // === 3. WRITES ===
            
            // Ticket Counter Logic
            let nextNum = 1;
            if (configDoc.exists()) {
                nextNum = (configDoc.data().ticketCounter || 0) + 1;
                transaction.update(configRef, { ticketCounter: nextNum });
            } else {
                transaction.set(configRef, { ticketCounter: 1 });
            }

            // Customer Logic
            if (custDoc && custDoc.exists()) {
                const existingBikes = custDoc.data().bikes || [];
                // Only update if bike not present
                if (!existingBikes.includes(cleanUnit)) {
                    transaction.update(custRef, { bikes: [...existingBikes, cleanUnit] });
                }
            } else {
                // New Customer
                transaction.set(custRef, {
                    id: finalCustomerId, 
                    name: cleanName,
                    phone: cleanPhone,
                    bikes: [cleanUnit]
                });
            }

            // Create Ticket
            transaction.set(ticketRef, {
                id: uniqueDocId,
                branch,
                customerName: cleanName,
                phone: cleanPhone,
                unitSepeda: cleanUnit,
                serviceTypes,
                mechanic: null,
                status: 'waiting',
                notes: notes || null,
                ticketNumber: nextNum.toString(),
                timestamps: { arrival: timestamp, called: null, ready: null, finished: null }
            });
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
        alert("Gagal membuat tiket. Cek koneksi.");
    }
};

export const updateTicketStatusInCloud = async (id: string, currentTicket: Ticket, status: TicketStatus, mechanic?: string, notes?: string, reason?: string) => {
    if (!db) return;
    const updates: any = { status };
    if (status === 'active' && currentTicket.status === 'waiting') updates['timestamps.called'] = new Date().toISOString();
    if (status === 'ready') updates['timestamps.ready'] = new Date().toISOString();
    if (status === 'done') updates['timestamps.finished'] = new Date().toISOString();
    if (mechanic !== undefined) updates.mechanic = mechanic;
    if (reason !== undefined) updates.cancellationReason = reason;
    
    let finalNotes = notes;
    if (notes !== undefined && status === 'pending' && currentTicket.notes) {
         const timestamp = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
         finalNotes = `${currentTicket.notes} | [${timestamp}] ${notes}`;
    }
    if (finalNotes !== undefined) updates.notes = finalNotes;

    await updateDoc(doc(db, 'tickets', id), updates);
};

export const updateTicketServicesInCloud = async (id: string, serviceTypes: string[], notes?: string) => {
    if (!db) return;
    const updates: any = { serviceTypes };
    if (notes !== undefined) updates.notes = notes;
    await updateDoc(doc(db, 'tickets', id), updates);
};

export const updateCustomerInCloud = async (id: string, name: string, phone: string, bikes: string[]) => {
    if (!db) return;
    await updateDoc(doc(db, 'customers', id), { name, phone, bikes });
};

export const removeCustomerFromCloud = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'customers', id));
};

export const deleteStorageRequest = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'storageRequests', id));
};

const safeDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return new Date().toISOString();
        return d.toISOString();
    } catch {
        return new Date().toISOString();
    }
};

export const adjustStorageContract = async (slotId: string, newStartDate: string, newEndDate: string) => {
    if (!db) return;
    const safeStart = safeDate(newStartDate);
    const safeEnd = safeDate(newEndDate);
    
    const log: StorageLog = {
        id: Date.now().toString(),
        action: 'extend',
        timestamp: new Date().toISOString(),
        notes: `Contract adjusted. Start: ${safeStart}, End: ${safeEnd}`
    };

    const slotRef = doc(db, 'storageSlots', slotId);
    const slotSnap = await getDoc(slotRef);
    if (slotSnap.exists()) {
        const currentHistory = slotSnap.data().history || [];
        await updateDoc(slotRef, {
            inDate: safeStart,
            expiryDate: safeEnd,
            history: [...currentHistory, log]
        });
    }
};

export const moveStorageSlot = async (fromSlotId: string, toSlotId: string) => {
    if (!db) return;
    const timestamp = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, 'storageSlots', fromSlotId);
        const toRef = doc(db, 'storageSlots', toSlotId);
        
        // 1. READS
        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);

        if (!fromSnap.exists() || !toSnap.exists()) throw "Slot not found";
        
        const fromData = fromSnap.data() as StorageSlot;
        const toData = toSnap.data() as StorageSlot;

        if (fromData.status === 'vacant') throw "Source slot is empty";
        if (toData.status !== 'vacant') throw "Target slot is occupied";

        // 2. WRITES
        const customerSnapshot = {
            name: fromData.customerName || 'Unknown',
            bike: fromData.bikeModel || 'Unknown'
        };

        const leaveLog: any = {
            id: Date.now().toString() + '_1',
            action: 'checkout',
            timestamp,
            notes: `Moved to slot ${toSlotId}`,
            storageTicketId: fromData.storageTicketId || null,
            customerSnapshot: customerSnapshot
        };

        const arriveLog: any = {
            id: Date.now().toString() + '_2',
            action: 'check_in',
            timestamp,
            notes: `Moved from slot ${fromSlotId}`,
            storageTicketId: fromData.storageTicketId || null,
            customerSnapshot: customerSnapshot
        };

        // Transfer Data
        const toUpdate = sanitizePayload({
            status: fromData.status,
            lastActivity: fromData.lastActivity || timestamp,
            customerId: fromData.customerId,
            customerName: fromData.customerName,
            customerPhone: fromData.customerPhone,
            bikeModel: fromData.bikeModel,
            inDate: fromData.inDate,
            expiryDate: fromData.expiryDate,
            notes: fromData.notes,
            photos: fromData.photos,
            storageTicketId: fromData.storageTicketId,
            history: [...(toData.history || []), arriveLog]
        });

        transaction.update(toRef, toUpdate);

        // Clear Source
        transaction.update(fromRef, {
            status: 'vacant',
            customerId: deleteField(),
            customerName: deleteField(),
            customerPhone: deleteField(),
            bikeModel: deleteField(),
            inDate: deleteField(),
            expiryDate: deleteField(),
            notes: deleteField(),
            photos: deleteField(),
            storageTicketId: deleteField(),
            history: [...(fromData.history || []), leaveLog]
        });
    });
};

export const updateStorageSlot = async (slotId: string, updates: Partial<StorageSlot>, logAction?: 'ride_out' | 'ride_return' | 'checkout', logPhoto?: string) => {
    if (!db) return;
    const timestamp = new Date().toISOString();
    
    if (logAction === 'ride_out' || logAction === 'ride_return') {
        updates.lastActivity = timestamp;
    }

    const slotRef = doc(db, 'storageSlots', slotId);
    const slotSnap = await getDoc(slotRef);
    if (slotSnap.exists()) {
            const data = slotSnap.data();
            let history = data.history || [];
            
            const customerSnapshot = (data.status === 'occupied' || data.status === 'on_ride') ? {
                name: data.customerName || 'Unknown',
                bike: data.bikeModel || 'Unknown'
            } : null;

            if (logAction) {
                const log = sanitizePayload({
                    id: Date.now().toString(),
                    action: logAction,
                    timestamp,
                    notes: updates.notes, 
                    photo: logPhoto,
                    storageTicketId: data.storageTicketId,
                    customerSnapshot: customerSnapshot
                });
                history = [...history, log];
            }
            
            const firestoreUpdates: any = { history };
            Object.entries(updates).forEach(([key, value]) => {
                if (value === undefined) {
                    firestoreUpdates[key] = deleteField();
                } else {
                    firestoreUpdates[key] = value;
                }
            });

            await updateDoc(slotRef, firestoreUpdates);
    }
};

export const approveStorageRequest = async (
    reqId: string, 
    slotId: string, 
    data: { name: string, phone: string, bikeModel: string, startDate: string, endDate: string, notes: string, photos: string[] }
) => {
    if (!db) return;
    
    // Determine Customer ID logic OUTSIDE transaction to allow searching
    let customerId: string | null = null;
    try {
        const q = query(collection(db, 'customers'), where('phone', '==', data.phone));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            customerId = querySnapshot.docs[0].id;
        } else {
            customerId = 'CUST-' + Date.now();
        }
    } catch (e) {
        console.error("Error looking up customer:", e);
        customerId = 'CUST-' + Date.now();
    }

    const timestamp = new Date().toISOString();
    const storageTicketId = `ST-${Date.now().toString().slice(-6)}`; 
    const inDate = safeDate(data.startDate);
    const expiryDate = safeDate(data.endDate);
    
    const customerSnapshot = { name: data.name, bike: data.bikeModel };

    const log = sanitizePayload({
        id: Date.now().toString(),
        action: 'check_in',
        timestamp,
        notes: `Approved from request #${reqId.slice(-4)}. ${data.notes || ''}`,
        storageTicketId: storageTicketId,
        customerSnapshot
    });

    await runTransaction(db, async (transaction) => {
        // === 1. PREPARE REFS ===
        const slotRef = doc(db, 'storageSlots', slotId);
        const custRef = doc(db, 'customers', customerId!);
        const reqRef = doc(db, 'storageRequests', reqId);

        // === 2. EXECUTE ALL READS FIRST ===
        const slotDoc = await transaction.get(slotRef);
        const custDoc = await transaction.get(custRef);
        // We read request just to be safe with ordering, although we know it exists.
        const reqDoc = await transaction.get(reqRef);

        // === 3. WRITES ===
        
        // Upsert Customer
        if (custDoc.exists()) {
             const existingBikes = custDoc.data().bikes || [];
             if (!existingBikes.includes(data.bikeModel)) {
                transaction.update(custRef, { 
                    bikes: [...existingBikes, data.bikeModel],
                    name: data.name
                });
             }
        } else {
            transaction.set(custRef, {
                id: customerId,
                name: data.name,
                phone: data.phone,
                bikes: [data.bikeModel]
            });
        }

        // Update Slot
        const currentHistory = slotDoc.exists() ? (slotDoc.data().history || []) : [];
        const updatePayload = sanitizePayload({
            status: 'occupied',
            customerId: customerId, 
            customerName: data.name,
            customerPhone: data.phone,
            bikeModel: data.bikeModel,
            inDate: inDate,
            expiryDate: expiryDate,
            notes: data.notes,
            lastActivity: timestamp,
            history: [...currentHistory, log],
            photos: data.photos || [],
            storageTicketId: storageTicketId
        });

        transaction.update(slotRef, updatePayload);

        // Update Request
        if (reqDoc.exists()) {
            transaction.update(reqRef, { status: 'approved' });
        }
    });
};

export const checkInStorage = async (
  slotId: string, 
  customer: Customer | { name: string, phone: string, bikes: string[] },
  bikeModel: string,
  startDate: string,
  endDate: string,
  notes: string,
  photos: string[]
) => {
    if (!db) return;
    const inDate = safeDate(startDate);
    const expiryDate = safeDate(endDate);
    const timestamp = new Date().toISOString();
    const storageTicketId = `ST-${Date.now().toString().slice(-6)}`; 
    
    const customerSnapshot = { name: customer.name, bike: bikeModel };
    
    const log = sanitizePayload({
        id: Date.now().toString(),
        action: 'check_in',
        timestamp,
        notes: notes,
        storageTicketId: storageTicketId,
        customerSnapshot
    });

    await runTransaction(db, async (transaction) => {
            // === 1. PREPARE REFS ===
            const slotRef = doc(db, 'storageSlots', slotId);
            
            let customerId: string;
            let custRef;
            
            if ('id' in customer && customer.id) {
                customerId = customer.id;
                custRef = doc(db, 'customers', customerId);
            } else {
                custRef = doc(collection(db, 'customers'));
                customerId = custRef.id;
            }

            // === 2. EXECUTE ALL READS FIRST ===
            const slotDoc = await transaction.get(slotRef);
            
            // Read customer doc if ID known
            let custDoc = null;
            if ('id' in customer && customer.id) {
                custDoc = await transaction.get(custRef);
            }

            // === 3. WRITES ===
            
            // Customer Upsert
            if (custDoc && custDoc.exists()) {
                const bikes = custDoc.data().bikes || [];
                if (!bikes.includes(bikeModel)) {
                    transaction.update(custRef, { bikes: [...bikes, bikeModel] });
                }
            } else {
                transaction.set(custRef, {
                    id: customerId,
                    name: customer.name,
                    phone: customer.phone,
                    bikes: [bikeModel]
                });
            }

            // Slot Update
            const currentHistory = slotDoc.exists() ? (slotDoc.data().history || []) : [];
            const updatePayload = sanitizePayload({
                status: 'occupied',
                customerId,
                customerName: customer.name,
                customerPhone: customer.phone,
                bikeModel,
                inDate,
                expiryDate,
                notes: notes,
                lastActivity: inDate,
                history: [...currentHistory, log],
                photos: photos || [], 
                storageTicketId: storageTicketId
            });
            
            transaction.update(slotRef, updatePayload);
    });
};

// --- NEW EXPORTS ---

export const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
    return `${d}/${m}/${y} ${time}`;
};

export const addMechanicToCloud = async (name: string, branches: Branch[]) => {
    if (!db) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const mech: MechanicDefinition = { id, name, branches };
    await setDoc(doc(db, 'mechanics', id), mech);
};

export const updateMechanicInCloud = async (id: string, name: string, branches: Branch[]) => {
    if (!db) return;
    await updateDoc(doc(db, 'mechanics', id), { name, branches });
};

export const removeMechanicFromCloud = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'mechanics', id));
};

export const addServiceToCloud = async (name: string, branches: Branch[]) => {
    if (!db) return;
    const id = 'SVC-' + Date.now();
    const svc: ServiceDefinition = { id, name, branches };
    await setDoc(doc(db, 'services', id), svc);
};

export const updateServiceInCloud = async (id: string, name: string, branches: Branch[]) => {
    if (!db) return;
    await updateDoc(doc(db, 'services', id), { name, branches });
};

export const removeServiceFromCloud = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'services', id));
};

export const wipeDatabase = async () => {
    if (!db) return;
    // Note: Calling logic handles confirmation prompt, this function just executes.
    await wipeServiceData();
    await wipeStorageData();
};

export const wipeServiceData = async () => {
    if (!db) return;
    const collections = ['tickets', 'customers'];
    for (const colName of collections) {
        const q = query(collection(db, colName));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
};

export const wipeStorageData = async () => {
    if (!db) return;
    const collections = ['storageSlots', 'storageRequests'];
    for (const colName of collections) {
        const q = query(collection(db, colName));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    await initializeStorageSlots();
};

export const resetTicketNumber = async () => {
    if (!db) return;
    await setDoc(doc(db, 'settings', 'config'), { ticketCounter: 0 });
};

export const createStorageRequest = async (name: string, phone: string, bikeModel: string, durationMonths: number, notes?: string) => {
    if (!db) return;
    const req: StorageRequest = {
        id: 'REQ-' + Date.now(),
        name,
        phone,
        bikeModel,
        durationMonths,
        notes,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };
    await setDoc(doc(db, 'storageRequests', req.id), req);
};
