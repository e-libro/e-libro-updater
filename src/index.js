#!/usr/bin/env node

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as tar from "tar";
import unbzip2 from "unbzip2-stream";
import { pipeline } from "stream";
import { promisify } from "util";
import dotenv from "dotenv";
import db from "./models/index.js";
import { Command } from "commander";
import ora from "ora";
import { Book } from "./libs/index.js";
import winston from "winston";

// Configuración del logger utilizando Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'info.log', level: 'info' }),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ],
});

const pipelineAsync = promisify(pipeline);

dotenv.config();

const DB_URL = process.env.DB_URL;

const CATALOG_URL = "https://gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2";
const TAR_FILE = "catalog.tar.bz2";
const TEMP_FOLDER = "temp";
const CACHE_FOLDERS = "cache/epub";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMP_PATH = path.join(__dirname, TEMP_FOLDER);

const URL = CATALOG_URL;
const DOWNLOAD_PATH = path.join(TEMP_PATH, TAR_FILE);
const CACHE_PATH = path.join(TEMP_PATH, CACHE_FOLDERS);

const program = new Command();

/**
 * Main action handler for the program.
 * Initializes the process, handles errors, and ensures cleanup on completion.
 */
program
  .action(async (cmd) => {
    console.log(`Starting Project Gutenberg's catalog download and extraction operations and E-libro's database upsert operations.`);
    logger.info('Process started');
    
    const startSpinner = ora("Process starting...").start();
    
    try {
      startSpinner.succeed(`Process started at ${new Date().toISOString()}`);
      await downloadExtractUpsert();
    } catch (err) {
      logger.error(`Error: ${err.message}`);
      cleanUp();
      process.exit(1);
    }

    const finishSpinner = ora("Finishing process...").start();
    cleanUp();
    finishSpinner.succeed(`Process finished at ${new Date().toISOString()}`);
    logger.info(`Process finished at ${new Date().toISOString()}`);
    process.exit(0);
  });

/**
 * Get a list of subdirectories within a given directory.
 * 
 * @param {string} directoryPath - The path of the directory to scan.
 * @returns {string[]} An array of subdirectory names.
 */
function getSubdirectories(directoryPath) {
  return fs.readdirSync(directoryPath).filter((subdirectory) => {
    return fs.statSync(path.join(directoryPath, subdirectory)).isDirectory();
  });
}

/**
 * Clean up temporary files in the TEMP_PATH.
 * This function is designed to run after the main process is complete or if an error occurs.
 */
function cleanUp() {
  const cleanUpSpinner = ora("Cleaning up temporary files...").start();
  try {
    if (fs.existsSync(TEMP_PATH)) {
      fs.rmSync(TEMP_PATH, { recursive: true, force: true });
      cleanUpSpinner.succeed(`Temporary files cleaned up at ${new Date().toISOString()}`);
    }
  } catch (err) {
    cleanUpSpinner.fail(`Failed to clean up temporary files: ${err.message}`);
    logger.error(`Failed to clean up temporary files: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Data Transfer Object for Book entities.
 */
class BookDTO {
  /**
   * Constructs a BookDTO instance.
   * 
   * @param {number} gutenbergId - The unique identifier for the book in the Gutenberg Project.
   * @param {string} title - The title of the book.
   * @param {string[]} authors - An array of authors.
   * @param {string[]} translators - An array of translators.
   * @param {string} type - The type or genre of the book.
   * @param {string[]} subjects - An array of subjects covered by the book.
   * @param {string[]} languages - An array of languages in which the book is available.
   * @param {Object} formats - The available formats of the book.
  //  * @param {number} downloads - The number of downloads.
   * @param {string[]} bookShelves - An array of bookshelf categories.
   * @param {string} copyright - The copyright status of the book.
   */
  constructor(
    gutenbergId,
    title,
    authors,
    translators,
    type,
    subjects,
    languages,
    formats,
  //  downloads,
    bookShelves,
    copyright
  ) {
    this.gutenbergId = gutenbergId;
    this.title = title;
    this.authors = authors;
    this.translators = translators;
    this.type = type;
    this.subjects = subjects;
    this.languages = languages;
    this.formats = formats;
//    this.downloads = downloads;
    this.bookShelves = bookShelves;
    this.copyright = copyright;
  }
}

/**
 * Maps a Book entity to a BookDTO.
 * 
 * @param {Object} book - The book entity from the database or source.
 * @returns {BookDTO} The mapped BookDTO instance.
 * @throws Will throw an error if the book entity is not provided.
 */
function mapBookToBookResponseDTO(book) {
  if (!book) {
    throw new Error("Book entity is required");
  }

  return new BookDTO(
    book.id,
    book.title,
    book.authors,
    book.translators,
    book.type,
    book.subjects,
    book.languages,
    book.formats,
//    book.downloads,
    book.bookShelves,
    book.copyright
  );
}

/**
 * Downloads, extracts the catalog, and upserts the data into the database.
 * Handles the entire process flow including downloading, extraction, and updating the database.
 * 
 * @async
 * @throws Will throw an error if any step in the process fails.
 */
async function downloadExtractUpsert() {
  const spinner = ora();
  try {
    if (!fs.existsSync(TEMP_PATH)) {
      fs.mkdirSync(TEMP_PATH, { recursive: true });
    }

    spinner.start("Downloading catalog...");
    logger.info("Downloading catalog...");
    const response = await axios({
      url: URL,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(DOWNLOAD_PATH);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    spinner.succeed(
      `Catalog downloaded successfully at ${new Date().toISOString()}`
    );

    logger.info(
      `Catalog downloaded successfully at ${new Date().toISOString()}`
    );

    if (!fs.existsSync(CACHE_PATH)) {
      fs.mkdirSync(CACHE_PATH, { recursive: true });
    }

    spinner.start("Extracting catalog...");
    logger.info("Extracting catalog...");

    await pipelineAsync(
      fs.createReadStream(DOWNLOAD_PATH),
      unbzip2(),
      tar.x({ cwd: TEMP_PATH })
    );

    spinner.succeed(
      `Catalog extraction completed successfully at ${new Date().toISOString()}`
    );
    logger.info(
      `Catalog extraction completed successfully at ${new Date().toISOString()}`
    );

    if (fs.existsSync(CACHE_PATH)) {
      spinner.start("Upserting e-libro database");
      logger.info("Upserting e-libro database");

      const directoryPath = path.join(CACHE_PATH);
      const subdirectories = getSubdirectories(directoryPath);

      await db.mongoose.connect(DB_URL, {});

      for (const subdirectory of subdirectories) {
        const fileName = `pg${subdirectory}.rdf`;
        const filePath = path.join(directoryPath, subdirectory, fileName);

        if (!isNaN(Number(subdirectory))) {
          const book = await Book.getBook(subdirectory, filePath);

          const bookDTO = mapBookToBookResponseDTO(book);
          const filter = { gutenbergId: bookDTO.gutenbergId };
          const options = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          };

          await db.book.findOneAndUpdate(filter, bookDTO, options);
        }
      }

      spinner.succeed(
        `E-libro database upserted successfully at ${new Date().toISOString()}`
      );
      logger.info(
        `E-libro database upserted successfully at ${new Date().toISOString()}`
      );

      await db.mongoose.connection.close();

    } else {
      spinner.fail("Upsert failed: CACHE folder does not exist.");
      logger.error("Upsert failed: CACHE folder does not exist.");
      throw new Error("CACHE folder does not exist.");
      process.exit(1);
    }

  } catch (err) {
    spinner.fail(`Process failed: ${err.message}`);
    logger.error(`Process failed: ${err.message}`);
    cleanUp();
    throw err;
    process.exit(1);
  }
}

program.parse(process.argv);
