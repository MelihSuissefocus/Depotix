# RETURN Movement Feature Implementation

## Überblick

Die RETURN-Bewegungsfunktion wurde erfolgreich zum Depotix Frontend hinzugefügt, ohne bestehende IN/OUT-Funktionen zu beeinträchtigen. Die Implementierung folgt strikt den angegebenen Leitplanken.

## Implementierte Änderungen

### 1. Backend-Erweiterung (Optional)
- **Datei**: `/api/inventory/views.py`
- **Hinzugefügt**: Neue `return_()` Action im `StockMovementViewSet`
- **Endpoint**: `POST /api/stock-movements/return/`
- **Zweck**: Convenience-Wrapper für RETURN-Bewegungen

### 2. Frontend-API-Erweiterung
- **Datei**: `/lib/api.ts`
- **Hinzugefügt**: 
  - `customerAPI` für Kundenverwaltung
  - Erweiterte `stockMovementAPI` mit RETURN-Support
  - `createReturn()` Convenience-Wrapper
- **Type-Definition**: Customer Interface in `types.d.ts`

### 3. Modal-Erweiterung
- **Datei**: `/components/movement-modal.tsx`
- **Erweitert**: 
  - Support für `mode: "RETURN"`
  - Customer-Auswahl für OUT/RETURN-Bewegungen
  - Pflicht-Kundenwahl bei RETURN-Bewegungen
  - Live-Vorschau zeigt korrekten Bestandszuwachs bei RETURN
  - Orange Styling für RETURN-Button

### 4. Logs-Seite Erweiterung
- **Datei**: `/app/logs/page.tsx`
- **Hinzugefügt**: 
  - Neuer orange "+ Retoure" Button
  - RotateCcw Icon von Lucide React
  - Modal-Handler für RETURN-Modus

## Funktionalität

### RETURN-Bewegung erstellen:
1. Benutzer klickt auf "+ Retoure" Button
2. Modal öffnet sich mit Titel "Retoure buchen"
3. Pflichtfelder:
   - **Artikel**: Dropdown mit verfügbaren Artikeln und aktuellem Bestand
   - **Menge**: Entweder Gesamtmenge oder UoM-basiert (Pal/Pack/Einzel)
   - **Kunde**: Dropdown mit Kunden (Pflichtfeld!)
4. Optional: Notiz
5. Live-Vorschau zeigt Bestandserhöhung: `Aktuell + Menge = Neuer Bestand`
6. Submit sendet POST an `/api/stock-movements/` mit `type: "RETURN"`

### API-Payload Beispiel:
```json
{
  "type": "RETURN",
  "item": 5,
  "qty_base": 24,
  "customer": 3,
  "note": "Defekte Flaschen zurückgegeben"
}
```

### Backend-Validierung:
- RETURN-Bewegungen **müssen** einen Customer referenzieren
- Erhöht automatisch den Artikel-Bestand (`quantity += qty_base`)
- Erstellt InventoryLog-Eintrag mit Action "ADD"
- Live in Bewegungen-Liste sichtbar

## Styling
- **RETURN-Button**: Orange (`bg-orange-600 hover:bg-orange-700`)
- **Icon**: RotateCcw (Uhrzeigersinn-Rückwärts)
- **Modal-Titel**: "Retoure buchen"
- **Submit-Button**: Orange mit Text "Retoure buchen"

## Fehlerfälle
- **400**: Validierungsfehler → Feld-spezifische Fehlermeldungen
- **422**: Business-Regel verletzt → Generische Meldung
- **Kunde fehlt**: "Bitte wählen Sie einen Kunden für die Retoure aus"

## Erfüllung der Akzeptanzkriterien ✅

1. ✅ **Neuer Button „+ Retoure"** sichtbar neben IN/OUT
2. ✅ **Modal** erlaubt Artikel, Menge, Customer (Pflicht), Notiz
3. ✅ **POST /api/stock-movements/** mit `type="RETURN"` wird abgesetzt
4. ✅ **Erfolg** erzeugt neue Bewegung und erhöht den Bestand
5. ✅ **Bewegungen-Liste** aktualisiert sich; UI zeigt Erfolg/Fehler konsistent
6. ✅ **Keine Breaking Changes** an IN/OUT oder Backend-Kern

## Zusätzliche Features
- **Customer-API**: Vollständige CRUD-Operationen für Kunden
- **UoM-Support**: RETURN unterstützt sowohl qty_base als auch Pal/Pack/Einzel-Eingabe
- **Live-Preview**: Zeigt Bestandsänderung in Echtzeit
- **Icon-Konsistenz**: Durchgängige Lucide React Icons

## Testing
Frontend läuft auf `http://localhost:3003`
Backend läuft auf `http://localhost:8000`

Die Implementierung ist vollständig und folgt allen Leitplanken und Akzeptanzkriterien.
