CREATE TABLE `lesson_copy` (
	`lesson_id` text NOT NULL,
	`field` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`lesson_id`, `field`)
);
