-- Finales Script: Dialog-Zugriff nur für Administratoren
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Erst alle verfügbaren Menüs anzeigen um Dialog zu finden
SELECT 
    'Alle Menüs mit "dialog" oder "technical":' as info,
    id,
    name::text as menu_name,
    active
FROM ir_ui_menu 
WHERE name::text ILIKE '%dialog%'
   OR name::text ILIKE '%technical%'
ORDER BY name::text;

-- Verfügbare Gruppen anzeigen
SELECT 
    'Administrator-Gruppen:' as info,
    id,
    name 
FROM res_groups 
WHERE name::text ILIKE '%admin%' 
   OR name::text ILIKE '%settings%'
   OR name::text ILIKE '%access%'
ORDER BY name;

-- Dialog-Menüs für Administratoren einschränken (mit korrekter Spalte 'gid')
INSERT INTO ir_ui_menu_group_rel (menu_id, gid)
SELECT 
    m.id as menu_id,
    g.id as gid
FROM ir_ui_menu m
CROSS JOIN res_groups g
WHERE (m.name::text ILIKE '%dialog%' OR m.name::text ILIKE '%technical%')
  AND (g.name::text ILIKE '%settings%' OR g.name::text ILIKE '%admin%')
  AND NOT EXISTS (
    SELECT 1 FROM ir_ui_menu_group_rel 
    WHERE menu_id = m.id AND gid = g.id
  );

-- Alternative: Deaktiviere Dialog-Menüs komplett (auskommentiert)
-- UPDATE ir_ui_menu 
-- SET active = FALSE 
-- WHERE name::text ILIKE '%dialog%';

-- Alle technischen Menüs unter Settings einschränken
INSERT INTO ir_ui_menu_group_rel (menu_id, gid)
SELECT 
    m.id as menu_id,
    g.id as gid
FROM ir_ui_menu m
CROSS JOIN res_groups g
WHERE m.parent_id IN (
    SELECT id FROM ir_ui_menu 
    WHERE name::text ILIKE '%settings%'
)
AND m.name::text ILIKE '%technical%'
AND (g.name::text ILIKE '%settings%' OR g.name::text ILIKE '%admin%')
AND NOT EXISTS (
    SELECT 1 FROM ir_ui_menu_group_rel 
    WHERE menu_id = m.id AND gid = g.id
);

-- Ergebnis anzeigen
SELECT 
    'Geschützte Menüs:' as info,
    m.id,
    m.name::text as menu_name,
    m.active,
    CASE 
        WHEN EXISTS (SELECT 1 FROM ir_ui_menu_group_rel WHERE menu_id = m.id) 
        THEN 'Eingeschränkt'
        ELSE 'Öffentlich'
    END as access_level
FROM ir_ui_menu m
WHERE m.name::text ILIKE '%dialog%'
   OR m.name::text ILIKE '%technical%'
ORDER BY m.name::text;