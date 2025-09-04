-- Script zum Prüfen der Benutzerberechtigungen für bi-swiss@xmb-group.com
-- WICHTIG: Backup der Datenbank erstellen bevor Änderungen vorgenommen werden!

-- 1. Finde den Benutzer
SELECT 
    'Benutzer-Info:' as info,
    id,
    login,
    name,
    active
FROM res_users 
WHERE login = 'bi-swiss@xmb-group.com';

-- 2. Zeige alle Gruppen des Benutzers
SELECT 
    'Benutzer-Gruppen:' as info,
    u.login,
    g.name as group_name,
    g.id as group_id
FROM res_users u
JOIN res_groups_users_rel gur ON u.id = gur.uid
JOIN res_groups g ON gur.gid = g.id
WHERE u.login = 'bi-swiss@xmb-group.com'
ORDER BY g.name;

-- 3. Prüfe welche Menüs für diese Gruppen zugänglich sind
SELECT 
    'Menü-Zugriff über Gruppen:' as info,
    m.id as menu_id,
    m.name::text as menu_name,
    g.name::text as group_name
FROM ir_ui_menu m
JOIN ir_ui_menu_group_rel mgr ON m.id = mgr.menu_id
JOIN res_groups g ON mgr.gid = g.id
JOIN res_groups_users_rel gur ON g.id = gur.gid
JOIN res_users u ON gur.uid = u.id
WHERE u.login = 'bi-swiss@xmb-group.com'
  AND (m.name::text ILIKE '%dialog%' OR m.name::text ILIKE '%technical%')
ORDER BY m.name;

-- 4. Prüfe ob der Benutzer Admin-Rechte hat
SELECT 
    'Admin-Status:' as info,
    u.login,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM res_groups_users_rel gur 
            JOIN res_groups g ON gur.gid = g.id 
            WHERE gur.uid = u.id 
            AND (g.name::text ILIKE '%admin%' OR g.name::text ILIKE '%settings%')
        ) THEN 'Ist Administrator'
        ELSE 'Kein Administrator'
    END as admin_status
FROM res_users u
WHERE u.login = 'bi-swiss@xmb-group.com';

-- 5. Zeige alle Technical-Menü Berechtigungen
SELECT 
    'Technical-Menü Berechtigungen:' as info,
    m.id,
    m.name::text as menu_name,
    array_agg(g.name::text) as allowed_groups
FROM ir_ui_menu m
LEFT JOIN ir_ui_menu_group_rel mgr ON m.id = mgr.menu_id
LEFT JOIN res_groups g ON mgr.gid = g.id
WHERE m.name::text ILIKE '%technical%' OR m.name::text ILIKE '%dialog%'
GROUP BY m.id, m.name
ORDER BY m.name;