import * as http from 'http';
import { text } from 'node:stream/consumers';
import { z } from 'zod';
import { ManualService } from './manual.service';
import {
  InitRequestSchema,
  PreviewRequestSchema,
  SaveRequestSchema,
  AddTagRequestSchema,
  DeleteTagRequestSchema,
  ToggleDepRuleRequestSchema,
} from './models/dtos';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

export function createManualRoutes(): Map<string, Handler> {
  const service = new ManualService();
  const routes = new Map<string, Handler>();

  const post = <T>(path: string, schema: z.ZodSchema<T>, action: (dto: T) => unknown): void => {
    routes.set(`POST ${path}`, async (req, res) => {
      let json: string;
      try {
        const dto = schema.parse(JSON.parse(await text(req)));
        json = JSON.stringify(action(dto));
        res.statusCode = 200;
      } catch (e: unknown) {
        const error = e instanceof z.ZodError
          ? e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')
          : e instanceof Error ? e.message : String(e);
        json = JSON.stringify({ error });
        res.statusCode = 400;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(json));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(json);
    });
  };

  post('/api/manual/init', InitRequestSchema, (dto) => service.init(dto));
  post('/api/manual/init-default', InitRequestSchema, (dto) => service.initDefault(dto));
  post('/api/manual/preview', PreviewRequestSchema, (dto) => service.preview(dto));
  post('/api/manual/save', SaveRequestSchema, (dto) => service.save(dto));
  post('/api/manual/add-tag', AddTagRequestSchema, (dto) => service.addTag(dto));
  post('/api/manual/remove-tag', AddTagRequestSchema, (dto) => service.removeTag(dto));
  post('/api/manual/delete-tag-everywhere', DeleteTagRequestSchema, (dto) => service.deleteTagEverywhere(dto));
  post('/api/manual/toggle-dep-rule', ToggleDepRuleRequestSchema, (dto) => service.toggleDepRule(dto));

  return routes;
}
