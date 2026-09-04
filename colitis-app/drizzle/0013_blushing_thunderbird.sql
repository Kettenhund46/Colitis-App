CREATE TABLE `medication_schedule_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`doses_per_day` integer NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Bestandsdaten: ein erster Abschnitt je Medikament, ab seinem Startdatum und
-- mit der heute eingestellten Anzahl. Die Vergangenheit liest sich damit genau
-- wie vor dieser Migration; jede Aenderung ab jetzt wird sauber mitgeschrieben.
INSERT INTO `medication_schedule_history` (`medication_id`, `valid_from`, `valid_to`, `doses_per_day`)
SELECT `m`.`id`, `m`.`start_date`, `m`.`end_date`,
       MAX(1, (SELECT COUNT(*) FROM `medication_reminder_times` `r` WHERE `r`.`medication_id` = `m`.`id`))
FROM `medications` `m`;
