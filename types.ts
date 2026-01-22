export type TicketStatus = 'waiting' | 'active' | 'pending' | 'ready' | 'done' | 'cancelled';
export type Branch = 'mk' | 'pik'; // mk = Muara Karang, pik = PIK 2

export interface ServiceDefinition {
  id: string;
  name: string;
}

export interface MechanicDefinition {
  id: string;
  name: string;
}

export interface Timestamps {
  arrival: string; // ISO string
  called: string | null; // ISO string
  ready: string | null; // ISO string
  finished: string | null; // ISO string
}

export interface Ticket {
  id: string;
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