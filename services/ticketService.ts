import { DEFAULT_MECHANICS, DEFAULT_SERVICES } from "../constants";
import { Ticket, MechanicDefinition, ServiceDefinition } from "../types";

const TICKET_KEY = 'daily_bike_jkt_tickets';
const MECH_KEY = 'daily_bike_jkt_mechanics';
const SERV_KEY = 'daily_bike_jkt_services';

// Initial data to show the multi-branch capability
const INITIAL_DUMMY_DATA: Ticket[] = [
  {
    id: "1",
    branch: 'mk',
    customerName: "Budi (MK)",
    unitSepeda: "Specialized Tarmac SL7",
    phone: "08123456789",
    serviceTypes: ["Full Bike Spa", "Brake Bleeding"],
    mechanic: "Andi",
    status: "active",
    notes: "",
    timestamps: {
      arrival: new Date(new Date().setHours(14, 0)).toISOString(),
      called: new Date(new Date().setHours(14, 15)).toISOString(),
      ready: null,
      finished: null
    }
  },
  {
    id: "2",
    branch: 'mk',
    customerName: "Siti (MK)",
    unitSepeda: "Brompton M6L",
    phone: "08198765432",
    serviceTypes: ["Wheel Truing"],
    mechanic: null,
    status: "waiting",
    notes: "",
    timestamps: {
      arrival: new Date(new Date().setHours(14, 30)).toISOString(),
      called: null,
      ready: null,
      finished: null
    }
  },
  {
    id: "3",
    branch: 'pik',
    customerName: "Robert (PIK)",
    unitSepeda: "Cervelo S5",
    phone: "08122233344",
    serviceTypes: ["Build & Setup"],
    mechanic: "Arif",
    status: "active",
    notes: "Handlebar width 40cm",
    timestamps: {
      arrival: new Date(new Date().setHours(10, 0)).toISOString(),
      called: new Date(new Date().setHours(10, 15)).toISOString(),
      ready: null,
      finished: null
    }
  }
];

// --- Tickets ---
// NOTE FOR CLOUD DEPLOYMENT:
// To make this app work with a real Google Cloud backend, replace the localStorage calls below
// with fetch() calls to your API endpoints (e.g., Google Cloud Functions or Cloud Run).
// Example: return await fetch('https://api.dailybike.com/tickets').then(r => r.json());

export const getTickets = (): Ticket[] => {
  const stored = localStorage.getItem(TICKET_KEY);
  if (!stored) {
    localStorage.setItem(TICKET_KEY, JSON.stringify(INITIAL_DUMMY_DATA));
    return INITIAL_DUMMY_DATA;
  }
  return JSON.parse(stored);
};

export const saveTickets = (tickets: Ticket[]) => {
  localStorage.setItem(TICKET_KEY, JSON.stringify(tickets));
};

// --- Settings ---
export const getMechanics = (): MechanicDefinition[] => {
  const stored = localStorage.getItem(MECH_KEY);
  if (!stored) return DEFAULT_MECHANICS;
  return JSON.parse(stored);
};

export const saveMechanics = (mechanics: MechanicDefinition[]) => {
  localStorage.setItem(MECH_KEY, JSON.stringify(mechanics));
};

export const getServices = (): ServiceDefinition[] => {
  const stored = localStorage.getItem(SERV_KEY);
  if (!stored) return DEFAULT_SERVICES;
  return JSON.parse(stored);
};

export const saveServices = (services: ServiceDefinition[]) => {
  localStorage.setItem(SERV_KEY, JSON.stringify(services));
};

// --- Helpers ---
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