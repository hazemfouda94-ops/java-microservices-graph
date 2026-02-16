package com.analysis;

import com.analysis.extractor.DependencyExtractor;
import com.analysis.parser.JavaParserService;

public class Main {
    public static void main(String[] args) {
        // Initialize the Java parser service
        JavaParserService parserService = new JavaParserService();
        
        // Initialize the dependency extractor
        DependencyExtractor dependencyExtractor = new DependencyExtractor();
        
        // Trigger the analysis process
        parserService.parseJavaFiles();
        dependencyExtractor.extractDependencies();
        
        // Additional logic for visualization or further processing can be added here
    }
}