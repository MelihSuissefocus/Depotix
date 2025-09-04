-- Script zum Deaktivieren der Dialog-Menüs in der xmbgroup Datenbank
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Zeige aktuelle Dialog-Menüs
SELECT 
    'Aktuelle Dialog-Menüs:' as info,
    id, 
    name::text as menu_name, 
    active,
    parent_id
FROM ir_ui_menu 
WHERE name::text ILIKE '%dialog%' 
ORDER BY id;

-- Deaktiviere alle Dialog-Menüs
UPDATE ir_ui_menu 
SET active = FALSE 
WHERE name::text ILIKE '%dialog%'
  OR name::text ILIKE '%discuss%';

-- Bestätigung - zeige deaktivierte Menüs
SELECT 
    'Dialog-Menüs nach Deaktivierung:' as info,
    id, 
    name::text as menu_name, 
    active,
    parent_id
FROM ir_ui_menu 
WHERE name::text ILIKE '%dialog%' 
   OR name::text ILIKE '%discuss%'
ORDER BY id;

-- Cache leeren
DELETE FROM ir_attachment WHERE res_model = 'ir.ui.menu';