import { Express, Request, Response } from 'express';
import { GraphModel } from '../models/GraphModel';
import { GraphService } from '../services/graphService';

const graphService = new GraphService(new GraphModel());

export const setRoutes = (app: Express) => {
    app.post('/analysis/trigger', async (_req: Request, res: Response) => {
        try {
            const result = await graphService.triggerAnalysis();
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
};
