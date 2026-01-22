import { Ticket, ServiceDefinition, MechanicDefinition } from "./types";

export const DEFAULT_SERVICES: ServiceDefinition[] = [
  { id: '1', name: 'Full Bike Spa' },
  { id: '2', name: 'Drivetrain Cleaning' },
  { id: '3', name: 'Wheel Truing' },
  { id: '4', name: 'Build & Setup' },
  { id: '5', name: 'Brake Bleeding' },
  { id: '6', name: 'Bottom Bracket Service' }
];

export const DEFAULT_MECHANICS: MechanicDefinition[] = [
  { id: '1', name: 'Andi' },
  { id: '2', name: 'Wahyu' },
  { id: '3', name: 'Arif' }
];

export const INITIAL_DUMMY_DATA: Ticket[] = [
  {
    id: "1",
    branch: 'mk',
    customerName: "Budi",
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
    customerName: "Siti",
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
  }
];