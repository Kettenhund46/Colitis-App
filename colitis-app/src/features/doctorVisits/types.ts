export interface DoctorVisit {
  id: number;
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}

export interface DoctorVisitInput {
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}
