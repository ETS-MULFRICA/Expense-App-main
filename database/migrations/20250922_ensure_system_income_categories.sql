-- Migration: Ensure system income categories exist (idempotent and schema-aware)
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns 
		WHERE table_name = 'income_categories' AND column_name = 'user_id'
	) THEN
		-- Pick a valid user_id to satisfy NOT NULL (prefer admin if exists, else any user, else skip)
		IF EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
			WITH seed(name) AS (
				VALUES ('Wages'), ('Other'), ('Deals')
			)
			INSERT INTO income_categories (user_id, name, description, is_system)
			SELECT (SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1), s.name, CONCAT(s.name,' income'), true
			FROM seed s
			WHERE NOT EXISTS (
				SELECT 1 FROM income_categories ic WHERE ic.name = s.name AND ic.is_system = true
			);
		ELSIF EXISTS (SELECT 1 FROM users) THEN
			WITH seed(name) AS (
				VALUES ('Wages'), ('Other'), ('Deals')
			)
			INSERT INTO income_categories (user_id, name, description, is_system)
			SELECT (SELECT id FROM users ORDER BY id LIMIT 1), s.name, CONCAT(s.name,' income'), true
			FROM seed s
			WHERE NOT EXISTS (
				SELECT 1 FROM income_categories ic WHERE ic.name = s.name AND ic.is_system = true
			);
		ELSE
			-- No users exist; skip to avoid NOT NULL violation
			RAISE NOTICE 'Skipping system income categories seeding: no users in table';
		END IF;
	ELSE
		-- No user_id column; insert minimal rows if table allows name only
		IF EXISTS (
			SELECT 1 FROM information_schema.columns 
			WHERE table_name = 'income_categories' AND column_name = 'name'
		) THEN
			WITH seed(name) AS (
				VALUES ('Wages'), ('Other'), ('Deals')
			)
			INSERT INTO income_categories (name)
			SELECT s.name FROM seed s
			WHERE NOT EXISTS (SELECT 1 FROM income_categories ic WHERE ic.name = s.name);
		END IF;
	END IF;
END $$;
