export async function runEnrichmentOperation({ session, client, controller, indicator, profile } = {}) {
  if (!session || !client || !controller) throw new TypeError('enrichment operation dependencies required');
  session.startRequest(controller);
  try {
    const result = await client.enrich(indicator, profile, controller.signal);
    session.finishRequest(result);
    return result;
  } catch (error) {
    session.reset();
    throw error;
  }
}
