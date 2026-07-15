import { runFeedUpdate } from './runFeedUpdate';
import { fetchCurrentFeedFile, publishFeed } from './publish';
import { fetchPubmedItems } from './pubmedClient';
import { fetchAwmfItems } from './awmfClient';
import { fetchFdaItems } from './fdaClient';
import { fetchEmaItems } from './emaClient';
import { summarizeNewItems } from './summarize';

async function main(): Promise<void> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const publishToken = process.env.FEED_PUBLISH_TOKEN;

  if (!anthropicApiKey || !publishToken) {
    console.error('Missing required environment variables ANTHROPIC_API_KEY and/or FEED_PUBLISH_TOKEN.');
    process.exit(1);
    return;
  }

  try {
    const result = await runFeedUpdate(
      { fetchCurrentFeedFile, fetchPubmedItems, fetchAwmfItems, fetchFdaItems, fetchEmaItems, summarizeNewItems, publishFeed },
      { anthropicApiKey, publishToken },
      new Date()
    );
    console.log(
      `Feed update finished. Published: ${result.published}. Total items: ${result.publishedItemCount}. Failed sources: ${
        result.failedSources.join(', ') || 'none'
      }.`
    );
  } catch (error: unknown) {
    console.error('Feed update failed:', error);
    process.exit(1);
  }
}

main();
