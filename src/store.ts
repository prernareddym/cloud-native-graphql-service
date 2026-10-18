export type ReadingStatus = 'WANT_TO_READ' | 'READING' | 'FINISHED';

export interface AuthorRecord {
  id: string;
  name: string;
}

export interface BookRecord {
  id: string;
  title: string;
  authorId: string;
  status: ReadingStatus;
  rating: number | null;
  tags: string[];
}

export interface BookQuery {
  status?: ReadingStatus;
  search?: string;
  limit: number;
  offset: number;
}

export interface Stats {
  total: number;
  wantToRead: number;
  reading: number;
  finished: number;
  averageRating: number | null;
}

/** Persistence boundary. The in-memory implementation below could be swapped for a database. */
export interface Store {
  listAuthors(): Promise<AuthorRecord[]>;
  getAuthorsByIds(ids: readonly string[]): Promise<AuthorRecord[]>;
  addAuthor(name: string): Promise<AuthorRecord>;
  getBook(id: string): Promise<BookRecord | undefined>;
  queryBooks(query: BookQuery): Promise<{ items: BookRecord[]; total: number }>;
  getBooksByAuthorIds(ids: readonly string[]): Promise<BookRecord[]>;
  addBook(input: Omit<BookRecord, 'id'>): Promise<BookRecord>;
  updateBook(id: string, patch: Partial<Omit<BookRecord, 'id' | 'authorId'>>): Promise<BookRecord | undefined>;
  deleteBook(id: string): Promise<boolean>;
  stats(): Promise<Stats>;
}

export class InMemoryStore implements Store {
  private authors = new Map<string, AuthorRecord>();
  private books = new Map<string, BookRecord>();
  private nextAuthorId = 1;
  private nextBookId = 1;

  async listAuthors() {
    return [...this.authors.values()];
  }

  async getAuthorsByIds(ids: readonly string[]) {
    return ids.flatMap((id) => {
      const author = this.authors.get(id);
      return author ? [author] : [];
    });
  }

  async addAuthor(name: string) {
    const author = { id: String(this.nextAuthorId++), name };
    this.authors.set(author.id, author);
    return author;
  }

  async getBook(id: string) {
    return this.books.get(id);
  }

  async queryBooks({ status, search, limit, offset }: BookQuery) {
    const needle = search?.trim().toLowerCase();
    const matches = [...this.books.values()].filter(
      (book) => (!status || book.status === status) && (!needle || book.title.toLowerCase().includes(needle)),
    );
    return { items: matches.slice(offset, offset + limit), total: matches.length };
  }

  async getBooksByAuthorIds(ids: readonly string[]) {
    const wanted = new Set(ids);
    return [...this.books.values()].filter((book) => wanted.has(book.authorId));
  }

  async addBook(input: Omit<BookRecord, 'id'>) {
    const book = { ...input, id: String(this.nextBookId++) };
    this.books.set(book.id, book);
    return book;
  }

  async updateBook(id: string, patch: Partial<Omit<BookRecord, 'id' | 'authorId'>>) {
    const existing = this.books.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.books.set(id, updated);
    return updated;
  }

  async deleteBook(id: string) {
    return this.books.delete(id);
  }

  async stats() {
    const all = [...this.books.values()];
    const count = (status: ReadingStatus) => all.filter((b) => b.status === status).length;
    const rated = all.filter((b) => b.rating !== null).map((b) => b.rating as number);
    return {
      total: all.length,
      wantToRead: count('WANT_TO_READ'),
      reading: count('READING'),
      finished: count('FINISHED'),
      averageRating: rated.length === 0 ? null : rated.reduce((a, b) => a + b, 0) / rated.length,
    };
  }
}
