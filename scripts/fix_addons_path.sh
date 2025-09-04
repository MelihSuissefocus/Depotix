#!/bin/bash

# Backup der aktuellen odoo.conf
cp config/odoo.conf config/odoo.conf.bak.$(date +%s)

# Verwende awk, um die Datei zu bearbeiten
awk '
/^\[options\]/ { print; print "addons_path = /mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons"; next }
/addons_path/ { next }
{ print }
' config/odoo.conf > temp.conf && mv temp.conf config/odoo.conf
