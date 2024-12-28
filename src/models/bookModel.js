import mongoose from "mongoose";

const { Schema, model } = mongoose;

/**
 * Represents a schema for a book in the database.
 * 
 * @typedef {Object} BookSchema
 * @property {number} gutenbergId - The unique identifier for the book from Project Gutenberg.
 * @property {string} title - The title of the book.
 * @property {Array.<Author>} authors - An array of authors for the book.
 * @property {Array.<Translator>} translators - An array of translators for the book.
 * @property {string} type - The type or genre of the book.
 * @property {Array.<string>} subjects - An array of subjects related to the book.
 * @property {Array.<string>} languages - An array of languages in which the book is available.
 * @property {Array.<Format>} formats - An array of available formats for the book.
 * @property {number} [downloads] - The number of times the book has been downloaded.
 * @property {Array.<string>} bookShelves - An array of bookshelf categories for the book.
 * @property {boolean} [copyright] - The copyright status of the book.
 */

/**
 * Represents an author of the book.
 * 
 * @typedef {Object} Author
 * @property {string} name - The name of the author.
 * @property {number} [birthYear] - The birth year of the author.
 * @property {number} [deathYear] - The death year of the author.
 */

/**
 * Represents a translator of the book.
 * 
 * @typedef {Object} Translator
 * @property {string} name - The name of the translator.
 * @property {number} [birthYear] - The birth year of the translator.
 * @property {number} [deathYear] - The death year of the translator.
 */

/**
 * Represents a format in which the book is available.
 * 
 * @typedef {Object} Format
 * @property {string} contentType - The MIME type of the format.
 * @property {string} url - The URL where the format can be accessed.
 */

/**
 * The Mongoose schema for books in the database.
 * 
 * @type {Schema<BookSchema>}
 */
const bookSchema = new Schema(
  {
    gutenbergId: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    authors: [
      {
        name: { type: String, required: true },
        birthYear: { type: Number },
        deathYear: { type: Number },
      },
    ],
    translators: [
      {
        name: { type: String, required: true },
        birthYear: { type: Number },
        deathYear: { type: Number },
      },
    ],
    type: { type: String, required: true },
    subjects: [{ type: String }],
    languages: [{ type: String }],
    formats: [
      {
        contentType: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    downloads: { type: Number },
    bookShelves: [{ type: String }],
    copyright: { type: Boolean },
  },
  { collection: "books" }
);

/**
 * The Mongoose model for books, based on the bookSchema.
 * 
 * @typedef {Model<BookSchema>} Book
 */
const Book = model("Book", bookSchema);

export default Book;
