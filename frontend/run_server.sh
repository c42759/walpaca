#!/bin/sh

if [ "$PRODUCTION" = "0" ]; then
  exec npm run dev
else
  npm run build && exec npm run start
fi

