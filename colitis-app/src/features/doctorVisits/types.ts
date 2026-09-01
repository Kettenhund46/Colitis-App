export interface DoctorVisit {
  id: number;
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
  /**
   * Kennung der geplanten Erinnerung an den Folgetermin. Gehoert bewusst nicht
   * zu `DoctorVisitInput`: Sie entsteht beim Planen, nicht im Formular.
   */
  nextAppointmentNotificationId: string | null;
}

export interface DoctorVisitInput {
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}
