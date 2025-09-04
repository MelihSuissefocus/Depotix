-- Script zum Sperren des Dialog-Menüreiters für nicht-technische Benutzer
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Erstelle eine neue Gruppe für technische Benutzer (falls nicht vorhanden)
INSERT INTO res_groups (name, category_id, comment)
SELECT 
    'Technical Users - Dialog Access',
    (SELECT id FROM ir_module_category WHERE name = 'Technical Settings' LIMIT 1),
    'Users with access to Dialog menu and technical features'
WHERE NOT EXISTS (
    SELECT 1 FROM res_groups WHERE name = 'Technical Users - Dialog Access'
);

-- Finde das Dialog-Menü
-- Das Dialog-Menü ist normalerweise unter Settings > Technical zu finden
UPDATE ir_ui_menu 
SET groups_id = (
    SELECT ARRAY[id] FROM res_groups 
    WHERE name = 'Technical Users - Dialog Access' 
    LIMIT 1
)
WHERE name ILIKE '%dialog%' 
   OR name ILIKE '%technical%dialog%'
   OR xml_id ILIKE '%dialog%';

-- Alternative: Verstecke alle technischen Menüs für normale Benutzer
-- Aktualisiere Menüs die unter "Technical Settings" stehen
UPDATE ir_ui_menu 
SET groups_id = (
    SELECT ARRAY[
        (SELECT id FROM res_groups WHERE name = 'Administration / Settings' LIMIT 1),
        (SELECT id FROM res_groups WHERE name = 'Technical Users - Dialog Access' LIMIT 1)
    ]
)
WHERE parent_id IN (
    SELECT id FROM ir_ui_menu 
    WHERE name ILIKE '%technical%' 
       OR xml_id ILIKE '%technical%'
)
AND groups_id IS NULL;

-- Spezifische Einschränkung für Dialog-bezogene Menüpunkte
UPDATE ir_ui_menu 
SET groups_id = (
    SELECT ARRAY[id] FROM res_groups 
    WHERE name = 'Technical Users - Dialog Access' 
    LIMIT 1
)
WHERE (
    name ILIKE '%dialog%' 
    OR name ILIKE '%technical%' 
    OR xml_id ILIKE '%dialog%'
    OR xml_id ILIKE '%technical%'
)
AND groups_id IS NULL;

-- Cache leeren für Menü-Änderungen
DELETE FROM ir_attachment WHERE res_model = 'ir.ui.menu';

-- Zeige welche Menüs betroffen sind
SELECT 
    id,
    name,
    xml_id,
    groups_id,
    parent_id
FROM ir_ui_menu 
WHERE name ILIKE '%dialog%' 
   OR name ILIKE '%technical%'
   OR xml_id ILIKE '%dialog%'
ORDER BY parent_id, sequence;