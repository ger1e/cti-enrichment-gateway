import { renderHttpError, writeVercelResponse } from '../../src/app.js';

export default async function handler(req, res) {
  writeVercelResponse(res, renderHttpError(req, 404, 'not_found'));
}
