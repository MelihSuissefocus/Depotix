-- Korrigiertes Script: Dialog-Zugriff nur für Administratoren
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Erst prüfen welche Dialog-Menüs vorhanden sind
SELECT 
    'Dialog-Menüs gefunden:' as info,
    id,
    name,
    active
FROM ir_ui_menu 
WHERE name::text ILIKE '%dialog%'
ORDER BY name;

-- Finde die Administrator-Gruppe
SELECT 
    'Administrator-Gruppen:' as info,
    id,
    name 
FROM res_groups 
WHERE name ILIKE '%admin%' 
   OR name ILIKE '%settings%'
   OR name ILIKE '%access rights%'
ORDER BY name;

-- Dialog-Menüs für normale Benutzer verstecken
-- Methode 1: Setze Gruppen-Berechtigung für Dialog-Menüs
INSERT INTO ir_ui_menu_group_rel (menu_id, group_id)
SELECT 
    m.id as menu_id,
    g.id as group_id
FROM ir_ui_menu m
CROSS JOIN res_groups g
WHERE m.name::text ILIKE '%dialog%'
  AND g.name ILIKE '%settings%'
  AND NOT EXISTS (
    SELECT 1 FROM ir_ui_menu_group_rel 
    WHERE menu_id = m.id AND group_id = g.id
  );

-- Methode 2: Deaktiviere Dialog-Menüs komplett (optional - auskommentiert)
-- UPDATE ir_ui_menu 
-- SET active = FALSE 
-- WHERE name::text ILIKE '%dialog%';

-- Zeige Ergebnis
SELECT 
    'Geschützte Dialog-Menüs:' as info,
    m.id,
    m.name,
    m.active,
    CASE 
        WHEN EXISTS (SELECT 1 FROM ir_ui_menu_group_rel WHERE menu_id = m.id) 
        THEN 'Eingeschränkt'
        ELSE 'Öffentlich'
    END as access_level
FROM ir_ui_menu m
WHERE m.name::text ILIKE '%dialog%'
ORDER BY m.name;