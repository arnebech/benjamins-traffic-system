#!/bin/bash 
rsync -avz --exclude .git/  --exclude node_modules/ --exclude config/config.machine.ini ./ pi@10.100.0.30:/home/pi/bts