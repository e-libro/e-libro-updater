import mongoose from "mongoose";
import Book from "./bookModel.js";

mongoose.Promise = global.Promise;

const db = {
  mongoose: mongoose,
  book: Book,
};

export default db;
