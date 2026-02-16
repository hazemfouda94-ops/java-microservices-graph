import { GraphModel } from '../models/GraphModel';

export class GraphService {
    private graphModel: GraphModel;

    constructor(graphModel: GraphModel) {
        this.graphModel = graphModel;
    }

    public getNodes() {
        return this.graphModel.getNodes();
    }

    public getEdges() {
        return this.graphModel.getEdges();
    }

    public getDependencies(serviceName: string) {
        return this.graphModel.getDependencies(serviceName);
    }

    public addNode(node: any) {
        this.graphModel.addNode(node);
    }

    public addEdge(edge: any) {
        this.graphModel.addEdge(edge);
    }

    async triggerAnalysis(): Promise<unknown> {
        const self: any = this as any;
        if (typeof self.analyze === 'function') {
            return await self.analyze();
        }
        if (typeof self.runAnalysis === 'function') {
            return await self.runAnalysis();
        }
        if (typeof self.graphModel?.triggerAnalysis === 'function') {
            return await self.graphModel.triggerAnalysis();
        }
        if (typeof self.graphModel?.analyze === 'function') {
            return await self.graphModel.analyze();
        }
        throw new Error('No analysis method is available on GraphService/GraphModel');
    }

    async getResults(): Promise<unknown> {
        const self: any = this as any;
        if (typeof self.fetchResults === 'function') {
            return await self.fetchResults();
        }
        if (typeof self.getGraph === 'function') {
            return await self.getGraph();
        }
        if (typeof self.graphModel?.getResults === 'function') {
            return await self.graphModel.getResults();
        }
        if (typeof self.graphModel?.getGraph === 'function') {
            return await self.graphModel.getGraph();
        }
        throw new Error('No results method is available on GraphService/GraphModel');
    }
}
