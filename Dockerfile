FROM depotix:17.0

# sicherstellen, dass wir chown dürfen
USER root

# deine Addons & Config reinkopieren – direkt mit Besitzer gesetzt
COPY --chown=depotix:depotix ./addons /mnt/extra-addons
COPY --chown=depotix:depotix ./config /etc/depotix

# zurück zum Standard-User des Images
USER depotix

# Odoo liest diese Config
ENV DEPOTIX_RC=/etc/depotix/depotix.conf
