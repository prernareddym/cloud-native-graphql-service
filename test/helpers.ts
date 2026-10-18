import request from 'supertest';
import { createApp } from '../src/app';
import { InMemoryStore, type Store } from '../src/store';

export function setup(store: Store = new InMemoryStore()) {
  const app = createApp({ store });
  async function gql<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>) {
    const res = await request(app).post('/graphql').set('Content-Type', 'application/json').send({ query, variables });
    return { status: res.status, body: res.body as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] } };
  }
  return { app, store, gql };
}
