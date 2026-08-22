FROM postgres:18.6-bookworm@sha256:7d2695c3aa88e792e8b3b233e7e4adb296a20412c6c0ca361e3edaaacfada108

# Compose always runs this local database as the image's postgres user. The
# upstream root-only privilege-drop helper is therefore unnecessary, and
# removing it also removes its separately compiled Go vulnerability surface.
RUN rm -f /usr/local/bin/gosu

USER postgres
