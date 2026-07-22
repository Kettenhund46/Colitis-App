CREATE TABLE `doctor_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visit_date` text NOT NULL,
	`doctor_name` text,
	`reason` text,
	`note` text,
	`next_appointment_date` text
);
