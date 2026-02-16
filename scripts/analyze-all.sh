#!/bin/bash

# Navigate to the sample-repos directory
cd ../sample-repos

# Loop through each service directory
for service in */; do
    # Navigate into the service directory
    cd "$service"
    
    # Run the analysis command (assuming a Maven project)
    mvn clean compile exec:java -Dexec.mainClass="com.analysis.Main"
    
    # Navigate back to the sample-repos directory
    cd ..
done

# Optionally, you can add a command to visualize the results after analysis
# For example, you might want to call the API to fetch the results and visualize them
# curl http://localhost:3000/api/analysis/results