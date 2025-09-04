-- Script zum Deinstallieren von nicht benötigten Depotix-Modulen
-- WICHTIG: Backup der Datenbank erstellen bevor dieses Script ausgeführt wird!

-- Module auf 'uninstalled' setzen
UPDATE ir_module_module 
SET state = 'uninstalled' 
WHERE name IN (
    'crm',
    'website',
    'mass_mailing', 
    'event',
    'hr',
    'point_of_sale',
    'mrp',
    'project',
    'documents',
    'helpdesk',
    'im_livechat',
    'livechat',
    'website_livechat',
    'website_crm',
    'website_event',
    'website_mass_mailing',
    'hr_timesheet',
    'hr_holidays',
    'hr_attendance',
    'hr_recruitment',
    'project_timesheet',
    'crm_iap',
    'mass_mailing_sms',
    'analytic',
    'http_routing',
    'l10n_de',
    'mail',
    'portal',
    'resource',
    'sale',
    'web'
);

-- Entferne Menü-Einträge für diese Module
DELETE FROM ir_ui_menu 
WHERE id IN (
    SELECT res_id FROM ir_model_data 
    WHERE module IN (
        'crm', 'website', 'mass_mailing', 'event', 'hr', 
        'point_of_sale', 'mrp', 'project', 'documents', 
        'helpdesk', 'im_livechat', 'livechat', 'analytic',
        'http_routing', 'l10n_de', 'mail', 'portal', 
        'resource', 'sale', 'web'
    ) AND model = 'ir.ui.menu'
);

-- Cache leeren
DELETE FROM ir_attachment WHERE res_model = 'ir.ui.menu';
