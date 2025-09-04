-- Script zum Entfernen des Technical-Zugriffs für alle Nicht-Admin-Benutzer
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Zeige aktuelle Benutzer mit Technical Features
SELECT 
    'Benutzer mit Technical Features:' as info,
    u.id, 
    u.login,
    g.name::text as group_name
FROM res_users u
JOIN res_groups_users_rel gur ON u.id = gur.uid
JOIN res_groups g ON gur.gid = g.id
WHERE g.name::text ILIKE '%technical%' 
  AND u.active = true
ORDER BY u.login;

-- Entferne Technical Features von Demo-Benutzer (außer Admin)
DELETE FROM res_groups_users_rel 
WHERE uid IN (
    SELECT id FROM res_users 
    WHERE login != 'admin' AND active = true
) 
AND gid IN (
    SELECT id FROM res_groups 
    WHERE name::text ILIKE '%technical%'
);

-- Entferne auch Settings-Berechtigung von Demo-Benutzer
DELETE FROM res_groups_users_rel 
WHERE uid IN (
    SELECT id FROM res_users 
    WHERE login = 'demo' AND active = true
) 
AND gid IN (
    SELECT id FROM res_groups 
    WHERE name::text ILIKE '%settings%'
);

-- Zusätzlich: Stelle sicher, dass Technical-Menü wirklich nur für Admin-Gruppen sichtbar ist
DELETE FROM ir_ui_menu_group_rel
WHERE menu_id IN (
    SELECT id FROM ir_ui_menu 
    WHERE name::text ILIKE '%technical%'
);

-- Füge Technical-Menü nur für spezifische Admin-Gruppen hinzu
INSERT INTO ir_ui_menu_group_rel (menu_id, gid)
SELECT 
    m.id as menu_id,
    g.id as gid
FROM ir_ui_menu m
CROSS JOIN res_groups g
WHERE m.name::text ILIKE '%technical%'
  AND g.name::text IN (
    '{"en_US": "Settings"}',
    '{"en_US": "Access Rights"}'
  )
  AND NOT EXISTS (
    SELECT 1 FROM ir_ui_menu_group_rel 
    WHERE menu_id = m.id AND gid = g.id
  );

-- Zeige Ergebnis
SELECT 
    'Benutzer nach Bereinigung:' as info,
    u.id, 
    u.login,
    array_agg(g.name::text) as remaining_groups
FROM res_users u
JOIN res_groups_users_rel gur ON u.id = gur.uid
JOIN res_groups g ON gur.gid = g.id
WHERE u.active = true
GROUP BY u.id, u.login
ORDER BY u.login;

-- Cache leeren
DELETE FROM ir_attachment WHERE res_model = 'ir.ui.menu';
NOTIFY base_registry_signaling, 'base.clear_all_caches';