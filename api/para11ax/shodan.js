import { createShodanCommandHandler } from '../../src/shodan-command.js';
import { writeVercelResponse } from '../../src/app.js';

const handleShodan = createShodanCommandHandler();

export default async function handler(req, res) {
  const result = await handleShodan(req);
  writeVercelResponse(res, result);
}
