#!/bin/sh

if [ "$PRODUCTION" = "0" ]; then
  exec npm run dev
else
  exec npm run build && npm run start
fi

