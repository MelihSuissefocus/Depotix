/** @depotix-module **/

// Liste der zu versteckenden Module
const HIDDEN_MODULES = [
    'crm', 'website', 'mass_mailing', 'event', 'hr', 
    'point_of_sale', 'mrp', 'project', 'documents', 
    'helpdesk', 'im_livechat', 'livechat'
];

// Modul-Titel die versteckt werden sollen
const HIDDEN_MODULE_TITLES = [
    'CRM', 'Website', 'Email Marketing', 'Events', 'Employees',
    'Point of Sale', 'Manufacturing', 'Project', 'Documents',
    'Helpdesk', 'Live Chat', 'Website Live Chat'
];

function hideUnwantedModules() {
    // Warte bis DOM geladen ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideUnwantedModules);
        return;
    }

    // Funktion zum Verstecken der Module
    function doHide() {
        const moduleCards = document.querySelectorAll('.o_kanban_view.o_modules_kanban .o_kanban_record, .oe_module_vignette');
        
        moduleCards.forEach(card => {
            // Methode 1: Über Titel-Text
            const titleElement = card.querySelector('.o_kanban_record_title, h4');
            if (titleElement) {
                const title = titleElement.textContent.trim();
                const shouldHide = HIDDEN_MODULE_TITLES.some(hiddenTitle => 
                    title.toLowerCase().includes(hiddenTitle.toLowerCase())
                );
                
                if (shouldHide) {
                    card.style.display = 'none';
                    return;
                }
            }

            // Methode 2: Über Modulcode (für Entwickler-Ansicht)
            const codeElement = card.querySelector('code');
            if (codeElement) {
                const moduleCode = codeElement.textContent.trim();
                if (HIDDEN_MODULES.includes(moduleCode)) {
                    card.style.display = 'none';
                    return;
                }
            }

            // Methode 3: Über data-name Attribut
            const moduleName = card.getAttribute('data-name');
            if (moduleName && HIDDEN_MODULES.includes(moduleName)) {
                card.style.display = 'none';
                return;
            }
        });
    }

    // Sofort ausführen
    doHide();

    // Observer für dynamisch geladene Inhalte
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                setTimeout(doHide, 100); // Kurze Verzögerung für Rendering
            }
        });
    });

    // Observer starten
    const targetNode = document.body;
    if (targetNode) {
        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }

    // Regelmäßig prüfen (Fallback)
    setInterval(doHide, 2000);
}

// Starte beim Laden der Seite
hideUnwantedModules();
