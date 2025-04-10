-- Update the created_at column to use IST timezone
ALTER TABLE upload_details MODIFY created_at TIMESTAMP DEFAULT (CONVERT_TZ(CURRENT_TIMESTAMP,'+00:00','+05:30')); 