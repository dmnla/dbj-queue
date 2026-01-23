import { Ticket, ServiceDefinition, MechanicDefinition } from "./types";

export const DEFAULT_SERVICES: ServiceDefinition[] = [
  { id: '1', name: 'Full Bike Spa', branches: ['mk', 'pik'] },
  { id: '2', name: 'Drivetrain Cleaning', branches: ['mk', 'pik'] },
  { id: '3', name: 'Wheel Truing', branches: ['mk', 'pik'] },
  { id: '4', name: 'Build & Setup', branches: ['mk', 'pik'] },
  { id: '5', name: 'Brake Bleeding', branches: ['mk', 'pik'] },
  { id: '6', name: 'Bottom Bracket Service', branches: ['mk', 'pik'] }
];

export const DEFAULT_MECHANICS: MechanicDefinition[] = [
  { id: '1', name: 'Andi', branches: ['mk', 'pik'] },
  { id: '2', name: 'Wahyu', branches: ['mk', 'pik'] },
  { id: '3', name: 'Arif', branches: ['mk', 'pik'] }
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