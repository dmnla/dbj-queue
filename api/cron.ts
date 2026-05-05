import { v2 as cloudinary } from 'cloudinary';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

export default async function handler(req: any, res: any) {
  // If we only want GET or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Setup Cloudinary from standard environment variable CLOUDINARY_URL
  if (!process.env.CLOUDINARY_URL) {
    return res.status(500).json({ error: "CLOUDINARY_URL missing in environment variables." });
  }

  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
  };

  if (!firebaseConfig.apiKey) {
    return res.status(500).json({ error: "Firebase Config Missing in environment variables" });
  }

  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const now = new Date().toISOString();
    // Query for archived photos where deleteAfter has passed
    const q = query(collection(db, "archivedPhotos"), where("deleteAfter", "<", now));
    const snapshot = await getDocs(q);

    let totalDeleted = 0;
    const errors: any[] = [];

    // Process each document
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const urls: string[] = data.urls || [];
      const { slotId, storageTicketId } = data;
      
      const failedUrls: string[] = [];

      // Delete from Cloudinary
      for (const url of urls) {
        const publicId = getPublicIdFromUrl(url);
        if (publicId) {
          try {
             // result uses cloudinary API
             const result = await cloudinary.uploader.destroy(publicId);
             
             if (result.result !== 'ok' && result.result !== 'not found') {
                 failedUrls.push(url);
             }
          } catch(e) {
             failedUrls.push(url);
             errors.push(e);
          }
        } else {
             failedUrls.push(url);
        }
      }

      totalDeleted += (urls.length - failedUrls.length);

      // Now remove the successfully deleted urls from the slot document history
      if (slotId && storageTicketId) {
         try {
             const urlsToRemove = urls.filter(u => !failedUrls.includes(u));
             await removePhotosFromSlotHistory(db, slotId, storageTicketId, urlsToRemove);
         } catch(e) {
            console.error("Failed to update slot history", e);
            errors.push(e);
         }
      }

      // Cleanup document
      if (failedUrls.length === 0) {
        await deleteDoc(docSnap.ref);
      } else {
        await updateDoc(docSnap.ref, { urls: failedUrls, notes: "Some photos failed to delete from Cloudinary." });
      }
    }

    res.status(200).json({ success: true, processedDocuments: snapshot.docs.length, totalDeleted, errors });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Extract public_id from a cloudinary url
function getPublicIdFromUrl(url: string) {
    try {
      const parts = url.split('/upload/');
      if(parts.length < 2) return null;
      let path = parts[1];
      const pathParts = path.split('/');
      // Remove the version tag e.g v1234567
      if(pathParts[0].startsWith('v') && !isNaN(parseInt(pathParts[0].slice(1)))) {
         pathParts.shift();
      }
      return pathParts.join('/').replace(/\.[^/.]+$/, "");
    } catch {
      return null;
    }
}

// Find the slot, and strip out the photos from its history 
async function removePhotosFromSlotHistory(db: any, slotId: string, storageTicketId: string, urlsToRemove: string[]) {
   if(urlsToRemove.length === 0) return;
   const slotRef = doc(db, "storageSlots", slotId);
   const slotSnap = await getDoc(slotRef);
   if (!slotSnap.exists()) return;
   
   const data = slotSnap.data();
   let dirty = false;

   let finalPhotos = data.photos;
   if(data.storageTicketId === storageTicketId && Array.isArray(data.photos)) {
       finalPhotos = data.photos.filter((u: string) => !urlsToRemove.includes(u));
       if (finalPhotos.length !== data.photos.length) {
           dirty = true;
       }
   }

   const history = data.history || [];
   const newHistory = history.map((h: any) => {
       if (h.storageTicketId === storageTicketId && Array.isArray(h.photos)) {
           const hFinalPhotos = h.photos.filter((u: string) => !urlsToRemove.includes(u));
           if (hFinalPhotos.length !== h.photos.length) {
               dirty = true;
               return { ...h, photos: hFinalPhotos };
           }
       }
       // Fallback for single photo prop based on legacy data
       if (h.storageTicketId === storageTicketId && h.photo && urlsToRemove.includes(h.photo)) {
           dirty = true;
           return { ...h, photo: null };
       }
       return h;
   });

   if (dirty) {
      const updates: any = { history: newHistory };
      if (finalPhotos !== data.photos) updates.photos = finalPhotos;
      await updateDoc(slotRef, updates);
   }
}
