-- Ensure commonly used Judge0 languages are active after startup
UPDATE languages SET is_archived = false WHERE id IN (50, 54, 62, 63, 68, 71);

-- Verify language commands used by the portal
SELECT id, name, is_archived, compile_cmd, run_cmd
FROM languages
WHERE id IN (50, 54, 62, 63, 68, 71)
ORDER BY id;
