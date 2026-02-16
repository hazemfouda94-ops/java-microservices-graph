import { GraphModel } from '../models/GraphModel';

type AnyFn = (...args: unknown[]) => unknown;
type AnyModel = GraphModel & Record<string, unknown>;

export class GraphService {
    constructor(private readonly graphModel: GraphModel) {}

    async triggerAnalysis(microservicePath?: string) {
        const inputPath = microservicePath || process.env.MICROSERVICE_PATH;
        if (!inputPath) {
            throw new Error('microservicePath is required');
        }

        const model = this.graphModel as AnyModel;

        // Preferred explicit method name.
        const analyzeMicroservice = model['analyzeMicroservice'];
        if (typeof analyzeMicroservice === 'function') {
            return await (analyzeMicroservice as AnyFn).call(this.graphModel, inputPath);
        }

        // Backward-compatible fallbacks for existing model implementations.
        const fallbacks = ['triggerAnalysis', 'analyze', 'runAnalysis'] as const;
        for (const methodName of fallbacks) {
            const fn = model[methodName];
            if (typeof fn === 'function') {
                return await (fn as AnyFn).call(this.graphModel, inputPath);
            }
        }

        throw new Error('No analysis method is available on GraphService/GraphModel');
    }

    async getResults() {
        const model = this.graphModel as AnyModel;

        const candidates = ['getResults', 'getAnalysisResults', 'results'] as const;
        for (const methodName of candidates) {
            const fn = model[methodName];
            if (typeof fn === 'function') {
                return await (fn as AnyFn).call(this.graphModel);
            }
        }

        return null;
    }
}
