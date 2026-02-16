package com.analysis.extractor;

import com.analysis.model.GraphModel;
import java.util.HashMap;
import java.util.Map;

public class DependencyExtractor {

    private Map<String, GraphModel> dependencyGraph;

    public DependencyExtractor() {
        this.dependencyGraph = new HashMap<>();
    }

    public void analyzeDependencies(String microserviceName) {
        // Logic to analyze dependencies for the given microservice
    }

    public GraphModel getDependencyGraph(String microserviceName) {
        return dependencyGraph.get(microserviceName);
    }

    public void addDependency(String microserviceName, GraphModel graphModel) {
        dependencyGraph.put(microserviceName, graphModel);
    }
}