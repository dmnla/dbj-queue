
export type TicketStatus = 'waiting' | 'active' | 'pending' | 'ready' | 'done' | 'cancelled';
export type Branch = 'mk' | 'pik'; // mk = Muara Karang, pik = PIK 2

export interface ServiceDefinition {
  id: string;
  name: string;
  branches: Branch[]; // Which branches offer this service
}

export interface MechanicDefinition {
  id: string;
  name: string;
  branches: Branch[]; // Which branches this mechanic works at
}

export interface Timestamps {
  arrival: string; // ISO string
  called: string | null; // ISO string
  ready: string | null; // ISO string
  finished: string | null; // ISO string
}

export interface Ticket {
  id: string; // Unique Document ID (e.g. UUID or Timestamp)
  ticketNumber?: string; // Sequential Display ID (e.g. "1", "2")
  branch: Branch;
  customerName: string;
  unitSepeda: string;
  phone: string;
  serviceTypes: string[]; // Changed to array for multiple services
  mechanic: string | null;
  status: TicketStatus;
  notes: string;
  cancellationReason?: string;
  timestamps: Timestamps;
}

export interface KpiData {
  total: number;
  waiting: number;
  inProgress: number;
  ready: number;
  finished: number;
  cancelled: number;
}

// --- NEW TYPES FOR STORAGE & CUSTOMERS ---

export interface Customer {
  id: string;
  name: string;
  phone: string;
  bikes: string[]; // List of bike models owned
}

export type StorageStatus = 'vacant' | 'occupied' | 'on_ride';

export interface StorageLog {
  id: string;
  action: 'check_in' | 'ride_out' | 'ride_return' | 'checkout' | 'extend';
  timestamp: string;
  notes?: string;
  photo?: string; // Single photo for return/ride logs
  storageTicketId?: string; // Link log to a specific session
  customerSnapshot?: {
      name: string;
      bike: string;
  }; // Snapshot of customer data at time of log
}

export interface StorageSlot {
  id: string; // e.g. "A-01"
  status: StorageStatus;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  bikeModel?: string;
  inDate?: string; // ISO
  expiryDate?: string; // ISO
  notes?: string; // Defects or specific storage notes
  lastActivity?: string; // ISO
  storageTicketId?: string; // Unique ID for the current active session (e.g. ST-123456)
  // Changed from fixed object to array of strings for flexibility
  photos?: string[]; 
  history: StorageLog[]; // Log of activities
}

export interface StorageRequest {
  id: string;
  name: string;
  phone: string;
  bikeModel: string;
  durationMonths: number;
  notes?: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}
