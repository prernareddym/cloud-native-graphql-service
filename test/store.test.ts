import { InMemoryStore } from '../src/store';
import { seedSampleData } from '../src/seed';

describe('InMemoryStore', () => {
  it('assigns incrementing ids and ignores unknown author ids', async () => {
    const store = new InMemoryStore();
    const a = await store.addAuthor('A');
    const b = await store.addAuthor('B');

    expect([a.id, b.id]).toEqual(['1', '2']);
    expect(await store.getAuthorsByIds(['2', 'nope'])).toEqual([b]);
  });

  it('seeds sample data', async () => {
    const store = new InMemoryStore();
    await seedSampleData(store);

    expect((await store.queryBooks({ limit: 50, offset: 0 })).total).toBe(4);
    expect(await store.listAuthors()).toHaveLength(3);
  });
});
