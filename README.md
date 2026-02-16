# Java Microservices Graph

This project provides a framework for statically analyzing multiple Java microservices and visualizing the flow between them. It consists of three main modules: an analyzer, an API, and a visualizer.

## Project Structure

- **analyzer**: A Java application that analyzes microservices to extract dependencies and relationships.
  - **pom.xml**: Maven configuration for the analyzer module.
  - **src/main/java/com/analysis**: Contains the main application logic, including:
    - `Main.java`: Entry point for the application.
    - `parser/JavaParserService.java`: Service for parsing Java source files.
    - `extractor/DependencyExtractor.java`: Extracts dependencies between microservices.
    - `model/GraphModel.java`: Represents the structure of the dependency graph.
  - **src/main/resources/application.yml**: Configuration file for the application.
  - **src/test/java**: Contains unit tests for the analyzer.

- **api**: A Node.js API that serves as an interface for triggering analysis and retrieving results.
  - **package.json**: Configuration for the API module.
  - **tsconfig.json**: TypeScript configuration for the API module.
  - **src/index.ts**: Entry point for the API service.
  - **src/routes/analysis.ts**: Defines API endpoints for analysis.
  - **src/services/graphService.ts**: Interacts with analysis results.

- **visualizer**: A React application that visualizes the dependency graph.
  - **package.json**: Configuration for the visualizer module.
  - **tsconfig.json**: TypeScript configuration for the visualizer module.
  - **src/App.tsx**: Main component of the React application.
  - **src/components**: Contains components for rendering the graph and controls.
    - `GraphView.tsx`: Renders the dependency graph.
    - `Controls.tsx`: Provides UI elements for interaction.
  - **src/styles/main.css**: CSS styles for the visualizer.

- **sample-repos**: Contains sample microservices for testing the analyzer.
  - **service-a/pom.xml**: Maven configuration for service-a.
  - **service-b/pom.xml**: Maven configuration for service-b.

- **scripts**: Contains scripts for automating tasks.
  - `analyze-all.sh`: Automates the analysis of all microservices.
  - `start-dev.sh`: Starts the development environment.

- **docker-compose.yml**: Defines services and configurations for Docker containers.

- **.gitignore**: Specifies files to be ignored by version control.

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd java-microservices-graph
   ```

2. Set up the analyzer module:
   - Navigate to the `analyzer` directory and run:
     ```
     mvn install
     ```

3. Set up the API module:
   - Navigate to the `api` directory and run:
     ```
     npm install
     ```

4. Set up the visualizer module:
   - Navigate to the `visualizer` directory and run:
     ```
     npm install
     ```

5. Run the application:
   - Use the provided scripts to start the development environment:
     ```
     ./scripts/start-dev.sh
     ```

## Usage

- Access the API at `http://localhost:3000` to trigger analysis and retrieve results.
- The visualizer can be accessed at `http://localhost:3001` to view the dependency graph.

## Contribution Guidelines

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.