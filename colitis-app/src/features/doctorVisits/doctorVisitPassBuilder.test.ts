import { describe, it, expect } from 'vitest';
import { buildDoctorVisitPassHtml } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';

const today = new Date(2026, 6, 22);

describe('buildDoctorVisitPassHtml', () => {
  it('shows a hint text when the list is empty', () => {
    const html = buildDoctorVisitPassHtml([], today);
    expect(html).toContain('Keine Arztbesuche erfasst.');
  });

  it('renders the header with the current date', () => {
    const html = buildDoctorVisitPassHtml([], today);
    expect(html).toContain('Arztbesuch-Übersicht');
    expect(html).toContain('22.07.2026');
  });

  it('renders all fields when present', () => {
    const visit: DoctorVisit = {
      id: 1,
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller, Gastroenterologie',
      reason: 'Kontrolle',
      note: 'Blutwerte unauffällig',
      nextAppointmentDate: '2026-10-20',
    };

    const html = buildDoctorVisitPassHtml([visit], today);

    expect(html).toContain('20.07.2026');
    expect(html).toContain('Dr. Müller, Gastroenterologie');
    expect(html).toContain('Kontrolle');
    expect(html).toContain('Blutwerte unauffällig');
    expect(html).toContain('20.10.2026');
  });

  it('omits optional fields when null', () => {
    const visit: DoctorVisit = {
      id: 1,
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    };

    const html = buildDoctorVisitPassHtml([visit], today);

    expect(html).toContain('20.07.2026');
    expect(html).not.toContain('Nächster Termin');
  });

  it('escapes HTML special characters in free-text fields', () => {
    const visit: DoctorVisit = {
      id: 1,
      visitDate: '2026-07-20',
      doctorName: 'Dr. <Müller> & "Team"',
      reason: null,
      note: null,
      nextAppointmentDate: null,
    };

    const html = buildDoctorVisitPassHtml([visit], today);

    expect(html).toContain('Dr. &lt;Müller&gt; &amp; &quot;Team&quot;');
    expect(html).not.toContain('<Müller>');
  });
});
