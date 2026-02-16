#!/bin/bash

# Start the development environment for the API and visualizer modules

# Navigate to the API directory and start the server
cd api
npm install
npm run dev &

# Navigate to the visualizer directory and start the React application
cd ../visualizer
npm install
npm start &

# Wait for both services to start
wait

echo "Development environment started. API is running and visualizer is ready."