#!/bin/bash

# Install dependencies, build, remove node_modules and package-lock.json, install dependencies without dev dependencies
npm i && rm -rf dist && npm run build && rm -rf node_modules package-lock.json && npm install --omit=dev

# # Start the worker server
# npm run start:worker

# # Start the copy server
# npm run start:copy

