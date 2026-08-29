import { createUserScannerHandler } from '../../src/user-scanner.js';
import { writeVercelResponse } from '../../src/app.js';

const handleUserScanner = createUserScannerHandler();

export default async function handler(req, res) {
  const result = await handleUserScanner(req);
  writeVercelResponse(res, result);
}
