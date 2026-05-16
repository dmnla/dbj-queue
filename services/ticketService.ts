import { db, storage } from "./firebaseConfig";
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
  where,
  addDoc,
} from "firebase/firestore";
// Firebase storage imports removed since we now use Cloudinary

import {
  Ticket,
  MechanicDefinition,
  ServiceDefinition,
  TicketStatus,
  Branch,
  Customer,
  StorageSlot,
  StorageLog,
  StorageRequest,
} from "../types";
import { DEFAULT_MECHANICS, DEFAULT_SERVICES } from "../constants";

import imageCompression from 'browser-image-compression';

// --- HELPER: FILE UPLOAD (CLOUDINARY) ---
export const archivePhotoToCloud = async (urls: string[], days: number = 60) => {
  if (!db || urls.length === 0) return;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  
  await addDoc(collection(db, "archivedPhotos"), {
    urls,
    deleteAfter: expiry.toISOString(),
    timestamp: new Date().toISOString(),
    type: "follow_up"
  });
};

export const uploadFollowUpScreenshot = async (
  ticket: Ticket,
  file: File
): Promise<string | null> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  if (!cloudName || !uploadPreset) {
    console.error("Cloudinary config missing.");
    return null;
  }

  try {
    const config = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, config);

    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('upload_preset', uploadPreset);
    
    // Folder: follow_up/[NAME] - [SEPEDA] - [YYYY/MM/DD]
    const dateStr = new Date().toISOString().split('T')[0].split('-').join('/');
    const folderPath = `follow_up/${ticket.customerName} - ${ticket.unitSepeda} - ${dateStr}`;
    formData.append('folder', folderPath);

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      const url = data.secure_url;
      // Also archive this for 60 days
      await archivePhotoToCloud([url], 60);
      return url;
    }
  } catch (err) {
    console.error("Upload error:", err);
  }
  return null;
};

const uploadFilesToStorage = async (
  slotId: string,
  files: File[],
  customerName?: string,
  bikeModel?: string
): Promise<string[]> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Missing Cloudinary configuration (VITE_CLOUDINARY_CLOUD_NAME & VITE_CLOUDINARY_UPLOAD_PRESET). Tolong pastikan environment variable ini terisi di Vercel.");
  }

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const urls: string[] = [];

  for (const file of files) {
    let fileToUpload = file;
    
    // Compress image
    if (file.type.startsWith('image/')) {
      try {
        const options = {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        fileToUpload = await imageCompression(file, options);
      } catch (error) {
        console.error("Error compressing image, proceeding with original:", error);
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', uploadPreset);
    
    // Organize in folders: storage_photos/A-01/NAME - BIKE
    let folderPath = `storage_photos/${slotId}`;
    if (customerName && bikeModel) {
      folderPath += `/${customerName} - ${bikeModel}`;
    }
    formData.append('folder', folderPath);

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Cloudinary upload failed:", errText);
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    urls.push(data.secure_url);
  }
  return urls;
};

// --- HELPER: ARCHIVE PHOTOS ---
const archiveStoragePhotos = async (
  slotId: string,
  storageTicketId: string | undefined,
  urls: string[] | undefined,
) => {
  if (!urls || urls.length === 0 || !db) return;
  const checkoutDate = new Date();
  const expiryDate = new Date(checkoutDate);
  expiryDate.setDate(expiryDate.getDate() + 60);

  const archiveDoc = doc(collection(db, "archivedPhotos"));
  await setDoc(archiveDoc, {
    slotId,
    storageTicketId,
    urls,
    checkoutDate: checkoutDate.toISOString(),
    deleteAfter: expiryDate.toISOString(),
    notes:
      "These photos should be cleaned up after deleteAfter date by a CRON or admin task.",
  });
};

// --- HELPER: SEED FIRESTORE DEFAULTS ---
const seedFirestoreDefaults = async () => {
  if (!db) return;

  try {
    const servicesSnap = await getDocs(collection(db, "services"));
    if (servicesSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_SERVICES.forEach((s) => batch.set(doc(db, "services", s.id), s));
      await batch.commit();
      console.log("Seeded Services");
    }

    const mechanicsSnap = await getDocs(collection(db, "mechanics"));
    if (mechanicsSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_MECHANICS.forEach((m) =>
        batch.set(doc(db, "mechanics", m.id), m),
      );
      await batch.commit();
      console.log("Seeded Mechanics");
    }
  } catch (e) {
    console.error("Error seeding defaults:", e);
  }
};

// --- HELPER: SANITIZE FOR FIRESTORE ---
const sanitizePayload = (obj: any): any => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value === undefined) return null;
      return value;
    }),
  );
};

// --- SUBSCRIPTIONS ---

export const subscribeToTickets = (onUpdate: (tickets: Ticket[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, "tickets"));
  return onSnapshot(
    q,
    (snapshot) => {
      const tickets = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Ticket,
      );
      tickets.sort(
        (a, b) =>
          new Date(b.timestamps.arrival).getTime() -
          new Date(a.timestamps.arrival).getTime(),
      );
      onUpdate(tickets);
    },
    (error) => console.error("Ticket subscription error:", error),
  );
};

export const subscribeToMechanics = (
  onUpdate: (mechanics: MechanicDefinition[]) => void,
) => {
  if (!db) return () => {};
  const q = query(collection(db, "mechanics"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as MechanicDefinition,
    );
    if (data.length === 0) seedFirestoreDefaults();
    else onUpdate(data);
  });
};

export const subscribeToServices = (
  onUpdate: (services: ServiceDefinition[]) => void,
) => {
  if (!db) return () => {};
  const q = query(collection(db, "services"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as ServiceDefinition,
    );
    if (data.length === 0) seedFirestoreDefaults();
    else onUpdate(data);
  });
};

export const subscribeToCustomers = (
  onUpdate: (customers: Customer[]) => void,
) => {
  if (!db) return () => {};
  const q = query(collection(db, "customers"));
  return onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        phone: data.phone || "",
        bikes: Array.isArray(data.bikes) ? data.bikes : [],
      } as Customer;
    });
    customers.sort((a, b) => a.name.localeCompare(b.name));
    onUpdate(customers);
  });
};

export const subscribeToStorage = (
  onUpdate: (slots: StorageSlot[]) => void,
) => {
  if (!db) return () => {};
  const q = query(collection(db, "storageSlots"));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      initializeStorageSlots();
    } else {
      const slots = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as StorageSlot,
      );
      slots.sort((a, b) =>
        a.id.localeCompare(b.id, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      onUpdate(slots);
    }
  });
};

export const subscribeToStorageRequests = (
  onUpdate: (requests: StorageRequest[]) => void,
) => {
  if (!db) return () => {};
  const q = query(
    collection(db, "storageRequests"),
    where("status", "==", "pending"),
  );
  return onSnapshot(q, (snapshot) => {
    const reqs = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as StorageRequest,
    );
    reqs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    onUpdate(reqs);
  });
};

// --- ACTIONS ---

export const initializeStorageSlots = async () => {
  if (!db) return;
  const q = query(collection(db, "storageSlots"));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const batch = writeBatch(db);
  for (let i = 1; i <= 30; i++) {
    const id = `A-${String(i).padStart(2, "0")}`;
    const ref = doc(db, "storageSlots", id);
    batch.set(ref, {
      id,
      status: "vacant",
      lastActivity: new Date().toISOString(),
      history: [],
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
  customerId?: string,
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
      const configRef = doc(db, "settings", `config_${branch}`);
      const ticketRef = doc(db, "tickets", uniqueDocId);

      // Determine Customer Ref & ID outside getting
      let finalCustomerId = customerId;
      let custRef;

      if (finalCustomerId) {
        custRef = doc(db, "customers", finalCustomerId);
      } else {
        custRef = doc(collection(db, "customers")); // New Doc
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
          bikes: [cleanUnit],
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
        status: "waiting",
        notes: notes || null,
        ticketNumber: nextNum.toString(),
        timestamps: {
          arrival: timestamp,
          called: null,
          ready: null,
          taken: null,
          finished: null,
        },
      });
    });
  } catch (e) {
    console.error("Transaction failed: ", e);
    alert("Gagal membuat tiket. Cek koneksi.");
  }
};

export const updateTicketStatusInCloud = async (
  id: string,
  currentTicket: Ticket,
  status: TicketStatus,
  mechanic?: string,
  notes?: string,
  reason?: string,
  followUpResult?: 'Berhasil' | 'Kendala',
  followUpPhotoUrl?: string
) => {
  if (!db) return;
  const updates: any = { status };
  if (status === "active" && currentTicket.status === "waiting")
    updates["timestamps.called"] = new Date().toISOString();
  if (status === "ready")
    updates["timestamps.ready"] = new Date().toISOString();
  if (status === "taken")
    updates["timestamps.taken"] = new Date().toISOString();
  if (status === "done")
    updates["timestamps.finished"] = new Date().toISOString();
  if (mechanic !== undefined) updates.mechanic = mechanic;
  if (reason !== undefined) updates.cancellationReason = reason;
  if (followUpResult !== undefined) updates.followUpResult = followUpResult;
  if (followUpPhotoUrl !== undefined) updates.followUpPhotoUrl = followUpPhotoUrl;

  let finalNotes = notes;
  if (notes !== undefined && status === "pending" && currentTicket.notes) {
    const timestamp = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    finalNotes = `${currentTicket.notes} | [${timestamp}] ${notes}`;
  }
  if (finalNotes !== undefined) updates.notes = finalNotes;

  await updateDoc(doc(db, "tickets", id), updates);
};

export const updateTicketServicesInCloud = async (
  id: string,
  serviceTypes: string[],
  notes?: string,
) => {
  if (!db) return;
  const updates: any = { serviceTypes };
  if (notes !== undefined) updates.notes = notes;
  await updateDoc(doc(db, "tickets", id), updates);
};

export const debugFastForwardTaken = async (id: string) => {
  if (!db) return;
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  await updateDoc(doc(db, "tickets", id), {
    status: "taken",
    "timestamps.taken": threeDaysAgo.toISOString(),
  });
};

export const updateCustomerInCloud = async (
  id: string,
  name: string,
  phone: string,
  bikes: string[],
) => {
  if (!db) return;
  await updateDoc(doc(db, "customers", id), { name, phone, bikes });
};

export const removeCustomerFromCloud = async (id: string) => {
  if (!db) return;
  await deleteDoc(doc(db, "customers", id));
};

export const deleteStorageRequest = async (id: string) => {
  if (!db) return;
  await deleteDoc(doc(db, "storageRequests", id));
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

export const adjustStorageContract = async (
  slotId: string,
  newStartDate: string,
  newEndDate: string,
) => {
  if (!db) return;
  const safeStart = safeDate(newStartDate);
  const safeEnd = safeDate(newEndDate);

  const log: StorageLog = {
    id: Date.now().toString(),
    action: "extend",
    timestamp: new Date().toISOString(),
    notes: `Contract adjusted. Start: ${safeStart}, End: ${safeEnd}`,
  };

  const slotRef = doc(db, "storageSlots", slotId);
  const slotSnap = await getDoc(slotRef);
  if (slotSnap.exists()) {
    const currentHistory = slotSnap.data().history || [];
    await updateDoc(slotRef, {
      inDate: safeStart,
      expiryDate: safeEnd,
      history: [...currentHistory, log],
    });
  }
};

export const moveStorageSlot = async (fromSlotId: string, toSlotId: string) => {
  if (!db) return;
  const timestamp = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const fromRef = doc(db, "storageSlots", fromSlotId);
    const toRef = doc(db, "storageSlots", toSlotId);

    // 1. READS
    const fromSnap = await transaction.get(fromRef);
    const toSnap = await transaction.get(toRef);

    if (!fromSnap.exists() || !toSnap.exists()) throw "Slot not found";

    const fromData = fromSnap.data() as StorageSlot;
    const toData = toSnap.data() as StorageSlot;

    if (fromData.status === "vacant") throw "Source slot is empty";
    if (toData.status !== "vacant") throw "Target slot is occupied";

    // 2. WRITES
    const customerSnapshot = {
      name: fromData.customerName || "Unknown",
      bike: fromData.bikeModel || "Unknown",
    };

    const leaveLog: any = {
      id: Date.now().toString() + "_1",
      action: "checkout",
      timestamp,
      notes: `Moved to slot ${toSlotId}`,
      storageTicketId: fromData.storageTicketId || null,
      customerSnapshot: customerSnapshot,
    };

    const arriveLog: any = {
      id: Date.now().toString() + "_2",
      action: "check_in",
      timestamp,
      notes: `Moved from slot ${fromSlotId}`,
      storageTicketId: fromData.storageTicketId || null,
      customerSnapshot: customerSnapshot,
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
      history: [...(toData.history || []), arriveLog],
    });

    transaction.update(toRef, toUpdate);

    // Clear Source
    transaction.update(fromRef, {
      status: "vacant",
      customerId: deleteField(),
      customerName: deleteField(),
      customerPhone: deleteField(),
      bikeModel: deleteField(),
      inDate: deleteField(),
      expiryDate: deleteField(),
      notes: deleteField(),
      photos: deleteField(),
      storageTicketId: deleteField(),
      history: [...(fromData.history || []), leaveLog],
    });
  });
};

export const updateStorageSlot = async (
  slotId: string,
  updates: Partial<StorageSlot>,
  logAction?: "ride_out" | "ride_return" | "checkout",
  logPhoto?: File,
) => {
  if (!db) return;
  const timestamp = new Date().toISOString();

  let uploadedPhotoUrl: string | undefined = undefined;
  if (logPhoto) {
    // Fetch slot to get name and bike for naming the subfolder
    const slotSnap = await getDoc(doc(db, "storageSlots", slotId));
    let custName = "Unknown";
    let bikeModel = "Unknown";
    if (slotSnap.exists()) {
      const data = slotSnap.data();
      custName = data.customerName || "Unknown";
      bikeModel = data.bikeModel || "Unknown";
    }
    const urls = await uploadFilesToStorage(slotId, [logPhoto], custName, bikeModel);
    if (urls.length > 0) uploadedPhotoUrl = urls[0];
  }

  if (logAction === "checkout") {
    // Re-fetch here specifically to have current state if we didn't fetch above
    const slotSnapForCheckout = await getDoc(doc(db, "storageSlots", slotId));
    if (slotSnapForCheckout.exists()) {
      const data = slotSnapForCheckout.data() as StorageSlot;
      const sessionPhotos: string[] = [];
      if (data.photos) sessionPhotos.push(...data.photos);
      
      const history = data.history || [];
      history.forEach((h: any) => {
         if (h.storageTicketId === data.storageTicketId && h.photos) {
             sessionPhotos.push(...h.photos);
         }
      });
      if (uploadedPhotoUrl) {
          sessionPhotos.push(uploadedPhotoUrl);
      }

      if (sessionPhotos.length > 0) {
        await archiveStoragePhotos(slotId, data.storageTicketId, sessionPhotos);
      }
    }
  }

  if (logAction === "ride_out" || logAction === "ride_return") {
    updates.lastActivity = timestamp;
  }

  const slotRef = doc(db, "storageSlots", slotId);
  const slotSnap = await getDoc(slotRef);
  if (slotSnap.exists()) {
    const data = slotSnap.data();
    let history = data.history || [];

    const customerSnapshot =
      data.status === "occupied" || data.status === "on_ride"
        ? {
            name: data.customerName || "Unknown",
            bike: data.bikeModel || "Unknown",
          }
        : null;

    if (logAction) {
      const log = sanitizePayload({
        id: Date.now().toString(),
        action: logAction,
        timestamp,
        notes: updates.notes,
        photos: uploadedPhotoUrl ? [uploadedPhotoUrl] : [],
        storageTicketId: data.storageTicketId,
        customerSnapshot: customerSnapshot,
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
  data: {
    name: string;
    phone: string;
    bikeModel: string;
    startDate: string;
    endDate: string;
    notes: string;
    photos: File[];
  },
) => {
  if (!db) return;

  // 0. UPLOAD PHOTOS TO STORAGE FIRST
  let uploadedPhotoUrls: string[] = [];
  if (data.photos && data.photos.length > 0) {
    uploadedPhotoUrls = await uploadFilesToStorage(slotId, data.photos, data.name, data.bikeModel);
  }

  // Determine Customer ID logic OUTSIDE transaction to allow searching
  let customerId: string | null = null;
  try {
    const q = query(
      collection(db, "customers"),
      where("phone", "==", data.phone),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      customerId = querySnapshot.docs[0].id;
    } else {
      customerId = "CUST-" + Date.now();
    }
  } catch (e) {
    console.error("Error looking up customer:", e);
    customerId = "CUST-" + Date.now();
  }

  const timestamp = new Date().toISOString();
  const storageTicketId = `ST-${Date.now().toString().slice(-6)}`;
  const inDate = safeDate(data.startDate);
  const expiryDate = safeDate(data.endDate);

  const customerSnapshot = { name: data.name, bike: data.bikeModel };

  const log = sanitizePayload({
    id: Date.now().toString(),
    action: "check_in",
    timestamp,
    notes: `Approved from request #${reqId.slice(-4)}. ${data.notes || ""}`,
    storageTicketId: storageTicketId,
    customerSnapshot,
    photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : [],
  });

  await runTransaction(db, async (transaction) => {
    // === 1. PREPARE REFS ===
    const slotRef = doc(db, "storageSlots", slotId);
    const custRef = doc(db, "customers", customerId!);
    const reqRef = doc(db, "storageRequests", reqId);

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
          name: data.name,
        });
      }
    } else {
      transaction.set(custRef, {
        id: customerId,
        name: data.name,
        phone: data.phone,
        bikes: [data.bikeModel],
      });
    }

    // Update Slot
    const currentHistory = slotDoc.exists() ? slotDoc.data().history || [] : [];
    const updatePayload = sanitizePayload({
      status: "occupied",
      customerId: customerId,
      customerName: data.name,
      customerPhone: data.phone,
      bikeModel: data.bikeModel,
      inDate: inDate,
      expiryDate: expiryDate,
      notes: data.notes,
      lastActivity: timestamp,
      history: [...currentHistory, log],
      photos: uploadedPhotoUrls,
      storageTicketId: storageTicketId,
    });

    transaction.update(slotRef, updatePayload);

    // Update Request
    if (reqDoc.exists()) {
      transaction.update(reqRef, { status: "approved" });
    }
  });
};

export const checkInStorage = async (
  slotId: string,
  customer: Customer | { name: string; phone: string; bikes: string[] },
  bikeModel: string,
  startDate: string,
  endDate: string,
  notes: string,
  photos: File[],
) => {
  if (!db) return;

  let uploadedPhotoUrls: string[] = [];
  if (photos && photos.length > 0) {
    uploadedPhotoUrls = await uploadFilesToStorage(slotId, photos, customer.name, bikeModel);
  }
  const inDate = safeDate(startDate);
  const expiryDate = safeDate(endDate);
  const timestamp = new Date().toISOString();
  const storageTicketId = `ST-${Date.now().toString().slice(-6)}`;

  const customerSnapshot = { name: customer.name, bike: bikeModel };

  const log = sanitizePayload({
    id: Date.now().toString(),
    action: "check_in",
    timestamp,
    notes: notes,
    storageTicketId: storageTicketId,
    customerSnapshot,
    photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : [],
  });

  await runTransaction(db, async (transaction) => {
    // === 1. PREPARE REFS ===
    const slotRef = doc(db, "storageSlots", slotId);

    let customerId: string;
    let custRef;

    if ("id" in customer && customer.id) {
      customerId = customer.id;
      custRef = doc(db, "customers", customerId);
    } else {
      custRef = doc(collection(db, "customers"));
      customerId = custRef.id;
    }

    // === 2. EXECUTE ALL READS FIRST ===
    const slotDoc = await transaction.get(slotRef);

    // Read customer doc if ID known
    let custDoc = null;
    if ("id" in customer && customer.id) {
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
        bikes: [bikeModel],
      });
    }

    // Slot Update
    const currentHistory = slotDoc.exists() ? slotDoc.data().history || [] : [];
    const updatePayload = sanitizePayload({
      status: "occupied",
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      bikeModel,
      inDate,
      expiryDate,
      notes: notes,
      lastActivity: inDate,
      history: [...currentHistory, log],
      photos: uploadedPhotoUrls,
      storageTicketId: storageTicketId,
    });

    transaction.update(slotRef, updatePayload);
  });
};

// --- NEW EXPORTS ---

export const formatTime = (dateString: string | null | undefined) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const time = date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(".", ":");
  return `${d}/${m}/${y} ${time}`;
};

export const addMechanicToCloud = async (name: string, branches: Branch[]) => {
  if (!db) return;
  const id = name.toLowerCase().replace(/\s+/g, "_");
  const mech: MechanicDefinition = { id, name, branches };
  await setDoc(doc(db, "mechanics", id), mech);
};

export const updateMechanicInCloud = async (
  id: string,
  name: string,
  branches: Branch[],
) => {
  if (!db) return;
  await updateDoc(doc(db, "mechanics", id), { name, branches });
};

export const removeMechanicFromCloud = async (id: string) => {
  if (!db) return;
  await deleteDoc(doc(db, "mechanics", id));
};

export const addServiceToCloud = async (name: string, branches: Branch[]) => {
  if (!db) return;
  const id = "SVC-" + Date.now();
  const svc: ServiceDefinition = { id, name, branches };
  await setDoc(doc(db, "services", id), svc);
};

export const updateServiceInCloud = async (
  id: string,
  name: string,
  branches: Branch[],
) => {
  if (!db) return;
  await updateDoc(doc(db, "services", id), { name, branches });
};

export const removeServiceFromCloud = async (id: string) => {
  if (!db) return;
  await deleteDoc(doc(db, "services", id));
};

export const wipeDatabase = async () => {
  if (!db) return;
  // Note: Calling logic handles confirmation prompt, this function just executes.
  await wipeServiceData();
  await wipeStorageData();
};

export const wipeServiceData = async (branch?: string | null) => {
  if (!db) return;
  const collections = ["tickets", "customers"];
  for (const colName of collections) {
    let q;
    if (colName === "tickets" && branch) {
      q = query(collection(db, colName), where("branch", "==", branch));
    } else if (colName === "customers" && branch) {
      continue; // Don't wipe cross-branch customers when resetting a specific branch
    } else {
      q = query(collection(db, colName));
    }
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

export const wipeStorageData = async (branch?: string | null) => {
  if (!db) return;
  // Storage is currently scoped globally or PIK only.
  // If branch is MK, we skip wiping storage to avoid cross-branch wipes
  if (branch === "mk") return; 

  const collections = ["storageSlots", "storageRequests"];
  for (const colName of collections) {
    const q = query(collection(db, colName));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await initializeStorageSlots();
};

export const resetTicketNumber = async (branch?: string | null) => {
  if (!db) return;
  const docId = branch ? `config_${branch}` : "config";
  await setDoc(doc(db, "settings", docId), { ticketCounter: 0 });
};

export const createStorageRequest = async (
  name: string,
  phone: string,
  bikeModel: string,
  durationMonths: number,
  notes?: string,
) => {
  if (!db) return;
  const req: StorageRequest = {
    id: "REQ-" + Date.now(),
    name,
    phone,
    bikeModel,
    durationMonths,
    notes,
    timestamp: new Date().toISOString(),
    status: "pending",
  };
  await setDoc(doc(db, "storageRequests", req.id), req);
};
