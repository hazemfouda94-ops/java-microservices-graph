import { Express, Request, Response } from 'express';
import { GraphModel } from '../models/GraphModel';
import { GraphService } from '../services/graphService';

const graphService = new GraphService(new GraphModel());

export const setRoutes = (app: Express) => {
    app.post('/analysis/trigger', async (req: Request, res: Response) => {
        try {
            const microservicePath =
                typeof req.body?.microservicePath === 'string' ? req.body.microservicePath : undefined;
            const result = await graphService.triggerAnalysis(microservicePath);
            res.json(result);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    });

    app.get('/analysis/results', async (_req: Request, res: Response) => {
        try {
            const results = await graphService.getResults();
            res.json(results);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    });

    app.get('/analysis/nodes', async (_req: Request, res: Response) => {
        try {
            const results = await graphService.getResults();
            const nodes = Array.isArray(results)
                ? results
                : (results as { nodes?: unknown } | null)?.nodes;

            if (!Array.isArray(nodes)) {
                return res.status(404).json({ error: 'Nodes not found in analysis results' });
            }

            res.json(nodes);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    });
};
