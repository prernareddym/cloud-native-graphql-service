import { buildSchema } from 'graphql';

export const typeDefs = /* GraphQL */ `
  enum ReadingStatus {
    WANT_TO_READ
    READING
    FINISHED
  }

  type Author {
    id: ID!
    name: String!
    books: [Book!]!
  }

  type Book {
    id: ID!
    title: String!
    author: Author!
    status: ReadingStatus!
    "1 to 5, only when set"
    rating: Int
    tags: [String!]!
  }

  type BookPage {
    items: [Book!]!
    total: Int!
  }

  type ShelfStats {
    total: Int!
    wantToRead: Int!
    reading: Int!
    finished: Int!
    averageRating: Float
  }

  type Query {
    book(id: ID!): Book
    books(status: ReadingStatus, search: String, limit: Int = 10, offset: Int = 0): BookPage!
    authors: [Author!]!
    stats: ShelfStats!
  }

  input AddBookInput {
    title: String!
    authorId: ID!
    status: ReadingStatus = WANT_TO_READ
    rating: Int
    tags: [String!]
  }

  input UpdateBookInput {
    title: String
    status: ReadingStatus
    rating: Int
    tags: [String!]
  }

  type Mutation {
    addAuthor(name: String!): Author!
    addBook(input: AddBookInput!): Book!
    updateBook(id: ID!, input: UpdateBookInput!): Book!
    deleteBook(id: ID!): Boolean!
  }
`;

export const schema = buildSchema(typeDefs);
