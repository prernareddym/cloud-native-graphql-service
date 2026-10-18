import DataLoader from 'dataloader';
import type { AuthorRecord, BookRecord, Store } from './store';

export interface Loaders {
  author: DataLoader<string, AuthorRecord | undefined>;
  booksByAuthor: DataLoader<string, BookRecord[]>;
}

/** Created per request so batching and caching never leak between requests. */
export function createLoaders(store: Store): Loaders {
  return {
    // One store call for every author referenced in a list of books (avoids the N+1 problem).
    author: new DataLoader(async (ids) => {
      const found = new Map((await store.getAuthorsByIds(ids)).map((a) => [a.id, a]));
      return ids.map((id) => found.get(id));
    }),
    booksByAuthor: new DataLoader(async (ids) => {
      const books = await store.getBooksByAuthorIds(ids);
      return ids.map((id) => books.filter((b) => b.authorId === id));
    }),
  };
}
