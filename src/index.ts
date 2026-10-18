import { createApp } from './app';
import { seedSampleData } from './seed';
import { InMemoryStore } from './store';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 4000);
  const store = new InMemoryStore();
  if (process.env.SEED_SAMPLE_DATA !== 'false') await seedSampleData(store);

  const server = createApp({ store }).listen(port, () => {
    console.log(JSON.stringify({ level: 'info', msg: 'listening', port }));
  });

  // Kubernetes sends SIGTERM on pod shutdown; stop accepting connections and exit cleanly.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(JSON.stringify({ level: 'info', msg: 'shutting down', signal }));
      server.close(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
