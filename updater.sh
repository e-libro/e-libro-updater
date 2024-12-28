#!/bin/bash
if [ -d "/usr/local/lib/node_modules/@e-libro/updater" ]; then
    cd /usr/local/lib/node_modules/@e-libro/updater
    node --max-old-space-size=1024 src/index.js "$@"
fi