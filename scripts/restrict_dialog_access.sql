-- Einfacheres Script: Dialog-Zugriff nur für Administratoren
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Methode 1: Verstecke alle Dialog-bezogenen Menüs für normale Benutzer
UPDATE ir_ui_menu 
SET groups_id = (
    SELECT ARRAY[id] FROM res_groups 
    WHERE category_id = (
        SELECT id FROM ir_module_category 
        WHERE name = 'Administration' 
        LIMIT 1
    )
    AND name ILIKE '%settings%'
    LIMIT 1
)
WHERE (
    name ILIKE '%dialog%' 
    OR xml_id ILIKE '%dialog%'
)
AND groups_id IS NULL;

-- Methode 2: Verstecke technische Menüs unter Settings
UPDATE ir_ui_menu 
SET groups_id = (
    SELECT ARRAY[id] FROM res_groups 
    WHERE name = 'Administration / Settings'
    LIMIT 1
)
WHERE parent_id IN (
    SELECT id FROM ir_ui_menu 
    WHERE name = 'Settings'
)
AND (
    name ILIKE '%technical%'
    OR name ILIKE '%dialog%'
    OR xml_id ILIKE '%base.menu_administration%'
)
AND groups_id IS NULL;

-- Methode 3: Entferne Dialog-Menü komplett (Optional - nur wenn gewünscht)
-- VORSICHT: Diese Zeilen sind auskommentiert. Nur aktivieren wenn Dialog komplett entfernt werden soll
-- UPDATE ir_ui_menu SET active = FALSE WHERE name ILIKE '%dialog%';
-- UPDATE ir_ui_menu SET active = FALSE WHERE xml_id ILIKE '%dialog%';

-- Zeige betroffene Menüs
SELECT 
    'Betroffene Menüs:' as info,
    id,
    name,
    xml_id,
    active,
    CASE 
        WHEN groups_id IS NOT NULL THEN 'Eingeschränkt'
        ELSE 'Öffentlich'
    END as access_level
FROM ir_ui_menu 
WHERE name ILIKE '%dialog%' 
   OR xml_id ILIKE '%dialog%'
ORDER BY name;