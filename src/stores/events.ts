import { create } from 'zustand';

export type Appointment = {
  id: number;
  title: string;
  start: Date;
  end: Date;
  doctor?: string;
  type?: string;
  notes?: string;
};

type State = {
  events: Appointment[];
  addEvent: (event: Appointment) => void;
  setEvents: (events: Appointment[]) => void;
};

const useEventStore = create<State>((set) => ({
  events: [
    {
      id: 1,
      title: 'Initial Consultation — John Doe',
      start: new Date(2025, 10, 10, 10, 0),
      end: new Date(2025, 10, 10, 11, 0),
      doctor: 'Dr. Smith',
      type: 'Consultation',
      notes: 'First-time visit',
    },
  ],

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, { ...event, id: Date.now() }],
    })),

  setEvents: (events) => set({ events }),
}));

export default useEventStore;
