import type { Store } from './store';

/** A few public-domain titles so a fresh instance has something to query. */
export async function seedSampleData(store: Store): Promise<void> {
  const austen = await store.addAuthor('Jane Austen');
  const shelley = await store.addAuthor('Mary Shelley');
  const doyle = await store.addAuthor('Arthur Conan Doyle');

  await store.addBook({ title: 'Pride and Prejudice', authorId: austen.id, status: 'FINISHED', rating: 5, tags: ['classic', 'romance'] });
  await store.addBook({ title: 'Emma', authorId: austen.id, status: 'READING', rating: null, tags: ['classic'] });
  await store.addBook({ title: 'Frankenstein', authorId: shelley.id, status: 'FINISHED', rating: 4, tags: ['classic', 'gothic'] });
  await store.addBook({ title: 'The Hound of the Baskervilles', authorId: doyle.id, status: 'WANT_TO_READ', rating: null, tags: ['mystery'] });
}
