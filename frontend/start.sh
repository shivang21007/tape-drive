#!/bin/bash

# Install dependencies, build, remove node_modules and package-lock.json, install dependencies without dev dependencies and start the server
npm i  && rm -rf dist && npm run build && npm run preview