import request from 'supertest';
import { InMemoryStore } from '../src/store';
import { setup } from './helpers';

async function seeded() {
  const ctx = setup();
  const austen = await ctx.store.addAuthor('Jane Austen');
  const shelley = await ctx.store.addAuthor('Mary Shelley');
  await ctx.store.addBook({ title: 'Pride and Prejudice', authorId: austen.id, status: 'FINISHED', rating: 5, tags: [] });
  await ctx.store.addBook({ title: 'Emma', authorId: austen.id, status: 'READING', rating: null, tags: [] });
  await ctx.store.addBook({ title: 'Frankenstein', authorId: shelley.id, status: 'FINISHED', rating: 4, tags: ['gothic'] });
  return { ...ctx, austen, shelley };
}

describe('queries', () => {
  it('lists books with their authors', async () => {
    const { gql } = await seeded();

    const { body } = await gql<{ books: { total: number; items: { title: string; author: { name: string } }[] } }>(
      '{ books { total items { title author { name } } } }',
    );

    expect(body.errors).toBeUndefined();
    expect(body.data?.books.total).toBe(3);
    expect(body.data?.books.items.map((b) => [b.title, b.author.name])).toEqual([
      ['Pride and Prejudice', 'Jane Austen'],
      ['Emma', 'Jane Austen'],
      ['Frankenstein', 'Mary Shelley'],
    ]);
  });

  it('filters by status and searches by title, case-insensitively', async () => {
    const { gql } = await seeded();

    const finished = await gql<{ books: { total: number } }>('{ books(status: FINISHED) { total } }');
    const search = await gql<{ books: { items: { title: string }[] } }>('{ books(search: "FRANK") { items { title } } }');

    expect(finished.body.data?.books.total).toBe(2);
    expect(search.body.data?.books.items).toEqual([{ title: 'Frankenstein' }]);
  });

  it('pages results with limit and offset', async () => {
    const { gql } = await seeded();

    const { body } = await gql<{ books: { total: number; items: { title: string }[] } }>(
      '{ books(limit: 2, offset: 2) { total items { title } } }',
    );

    expect(body.data?.books.total).toBe(3);
    expect(body.data?.books.items).toEqual([{ title: 'Frankenstein' }]);
  });

  it('rejects out-of-range paging arguments', async () => {
    const { gql } = await seeded();

    const { body } = await gql('{ books(limit: 500) { total } }');

    expect(body.errors?.[0].message).toMatch(/limit/);
    expect(body.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns null for an unknown book', async () => {
    const { gql } = await seeded();

    const { body } = await gql<{ book: null }>('{ book(id: "999") { title } }');

    expect(body.data?.book).toBeNull();
  });

  it('resolves author.books and shelf statistics', async () => {
    const { gql } = await seeded();

    const { body } = await gql<{
      authors: { name: string; books: { title: string }[] }[];
      stats: { total: number; finished: number; reading: number; averageRating: number };
    }>('{ authors { name books { title } } stats { total finished reading averageRating } }');

    expect(body.data?.authors[0]).toEqual({ name: 'Jane Austen', books: [{ title: 'Pride and Prejudice' }, { title: 'Emma' }] });
    expect(body.data?.stats).toEqual({ total: 3, finished: 2, reading: 1, averageRating: 4.5 });
  });

  it('batches author lookups into a single store call (no N+1)', async () => {
    const { gql, store } = await seeded();
    const spy = jest.spyOn(store, 'getAuthorsByIds');

    await gql('{ books { items { title author { name } } } }');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('reports averageRating as null when nothing is rated', async () => {
    const { gql } = setup();

    const { body } = await gql<{ stats: { total: number; averageRating: number | null } }>('{ stats { total averageRating } }');

    expect(body.data?.stats).toEqual({ total: 0, averageRating: null });
  });
});

describe('mutations', () => {
  it('adds an author and a book with defaults and cleaned tags', async () => {
    const { gql } = setup();
    const author = await gql<{ addAuthor: { id: string } }>('mutation { addAuthor(name: "  Ursula K. Le Guin ") { id name } }');
    const authorId = author.body.data!.addAuthor.id;

    const { body } = await gql<{ addBook: { id: string; title: string; status: string; rating: number | null; tags: string[]; author: { name: string } } }>(
      `mutation($input: AddBookInput!) { addBook(input: $input) { id title status rating tags author { name } } }`,
      { input: { title: '  A Wizard of Earthsea ', authorId, tags: ['Fantasy', ' fantasy ', '', 'Classic'] } },
    );

    expect(body.errors).toBeUndefined();
    expect(body.data?.addBook).toMatchObject({
      title: 'A Wizard of Earthsea',
      status: 'WANT_TO_READ',
      rating: null,
      tags: ['fantasy', 'classic'],
      author: { name: 'Ursula K. Le Guin' },
    });
  });

  it('validates book input', async () => {
    const { gql, austen } = await seeded();
    const add = (input: Record<string, unknown>) =>
      gql(`mutation($input: AddBookInput!) { addBook(input: $input) { id } }`, { input });

    expect((await add({ title: '   ', authorId: austen.id })).body.errors?.[0].message).toMatch(/title/);
    expect((await add({ title: 'x', authorId: austen.id, rating: 6 })).body.errors?.[0].message).toMatch(/rating/);
    expect((await add({ title: 'x', authorId: '404' })).body.errors?.[0].message).toMatch(/does not exist/);
    // type errors are caught by the schema itself
    expect((await add({ authorId: austen.id })).body.errors).toBeDefined();
  });

  it('updates only the provided fields', async () => {
    const { gql } = await seeded();

    const { body } = await gql<{ updateBook: { title: string; status: string; rating: number } }>(
      'mutation { updateBook(id: "2", input: { status: FINISHED, rating: 3 }) { title status rating } }',
    );

    expect(body.data?.updateBook).toEqual({ title: 'Emma', status: 'FINISHED', rating: 3 });
  });

  it('can clear a rating by passing null', async () => {
    const { gql } = await seeded();

    const { body } = await gql<{ updateBook: { rating: number | null } }>('mutation { updateBook(id: "1", input: { rating: null }) { rating } }');

    expect(body.data?.updateBook.rating).toBeNull();
  });

  it('returns NOT_FOUND when updating a missing book', async () => {
    const { gql } = await seeded();

    const { body } = await gql('mutation { updateBook(id: "99", input: { title: "x" }) { id } }');

    expect(body.errors?.[0].extensions?.code).toBe('NOT_FOUND');
  });

  it('deletes a book and reports whether it existed', async () => {
    const { gql } = await seeded();

    const first = await gql<{ deleteBook: boolean }>('mutation { deleteBook(id: "1") }');
    const second = await gql<{ deleteBook: boolean }>('mutation { deleteBook(id: "1") }');
    const stats = await gql<{ stats: { total: number } }>('{ stats { total } }');

    expect(first.body.data?.deleteBook).toBe(true);
    expect(second.body.data?.deleteBook).toBe(false);
    expect(stats.body.data?.stats.total).toBe(2);
  });
});

describe('HTTP endpoints', () => {
  const { app } = setup(new InMemoryStore());

  it('serves liveness and readiness probes', async () => {
    await request(app).get('/healthz').expect(200, { status: 'ok' });
    await request(app).get('/readyz').expect(200, { status: 'ready' });
  });

  it('returns validation errors for unknown fields (HTTP 400 for the graphql-response+json media type)', async () => {
    const legacy = await request(app).post('/graphql').set('Content-Type', 'application/json').send({ query: '{ nope }' });
    expect(legacy.status).toBe(200);
    expect(legacy.body.errors[0].message).toMatch(/Cannot query field "nope"/);

    const strict = await request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/graphql-response+json')
      .send({ query: '{ nope }' });
    expect(strict.status).toBe(400);
  });

  it('does not advertise the framework', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
