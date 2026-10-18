import { GraphQLError } from 'graphql';
import type { Loaders } from './loaders';
import type { AuthorRecord, BookRecord, ReadingStatus, Store } from './store';

export type Context = {
  store: Store;
  loaders: Loaders;
};

function badInput(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function validateRating(rating: number | null | undefined): void {
  if (rating !== null && rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw badInput('rating must be an integer between 1 and 5');
  }
}

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed === '') throw badInput('title must not be blank');
  if (trimmed.length > 200) throw badInput('title must be at most 200 characters');
  return trimmed;
}

function cleanTags(tags: string[] | null | undefined): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter((t) => t !== ''))];
}

// graphql-js calls function-valued properties as resolvers (args, context), so these
// view objects expose relations lazily and through the per-request DataLoaders.
function authorView(author: AuthorRecord) {
  return {
    id: author.id,
    name: author.name,
    books: (_args: unknown, ctx: Context) => ctx.loaders.booksByAuthor.load(author.id).then((books) => books.map(bookView)),
  };
}

function bookView(book: BookRecord) {
  return {
    ...book,
    author: async (_args: unknown, ctx: Context) => {
      const author = await ctx.loaders.author.load(book.authorId);
      if (!author) throw new GraphQLError('Author not found', { extensions: { code: 'NOT_FOUND' } });
      return authorView(author);
    },
  };
}

export const rootValue = {
  async book({ id }: { id: string }, ctx: Context) {
    const book = await ctx.store.getBook(id);
    return book ? bookView(book) : null;
  },

  async books(
    args: { status?: ReadingStatus | null; search?: string | null; limit: number; offset: number },
    ctx: Context,
  ) {
    if (args.limit < 1 || args.limit > 50) throw badInput('limit must be between 1 and 50');
    if (args.offset < 0) throw badInput('offset must not be negative');
    const { items, total } = await ctx.store.queryBooks({
      status: args.status ?? undefined,
      search: args.search ?? undefined,
      limit: args.limit,
      offset: args.offset,
    });
    return { items: items.map(bookView), total };
  },

  async authors(_args: unknown, ctx: Context) {
    return (await ctx.store.listAuthors()).map(authorView);
  },

  stats: (_args: unknown, ctx: Context) => ctx.store.stats(),

  async addAuthor({ name }: { name: string }, ctx: Context) {
    const trimmed = name.trim();
    if (trimmed === '') throw badInput('name must not be blank');
    return authorView(await ctx.store.addAuthor(trimmed));
  },

  async addBook(
    { input }: { input: { title: string; authorId: string; status: ReadingStatus; rating?: number | null; tags?: string[] | null } },
    ctx: Context,
  ) {
    const title = cleanTitle(input.title);
    validateRating(input.rating);
    const [author] = await ctx.store.getAuthorsByIds([input.authorId]);
    if (!author) throw badInput(`authorId ${input.authorId} does not exist`);
    const book = await ctx.store.addBook({
      title,
      authorId: author.id,
      status: input.status,
      rating: input.rating ?? null,
      tags: cleanTags(input.tags),
    });
    return bookView(book);
  },

  async updateBook(
    { id, input }: { id: string; input: { title?: string | null; status?: ReadingStatus | null; rating?: number | null; tags?: string[] | null } },
    ctx: Context,
  ) {
    validateRating(input.rating);
    const patch: Partial<Omit<BookRecord, 'id' | 'authorId'>> = {};
    if (input.title != null) patch.title = cleanTitle(input.title);
    if (input.status != null) patch.status = input.status;
    if (input.rating !== undefined) patch.rating = input.rating;
    if (input.tags != null) patch.tags = cleanTags(input.tags);
    const updated = await ctx.store.updateBook(id, patch);
    if (!updated) throw new GraphQLError(`Book ${id} not found`, { extensions: { code: 'NOT_FOUND' } });
    return bookView(updated);
  },

  deleteBook: ({ id }: { id: string }, ctx: Context) => ctx.store.deleteBook(id),
};
