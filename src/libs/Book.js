import { DOMParser } from "xmldom";
import fs from "fs";

/**
 * Pattern to match line breaks and surrounding whitespace.
 * Used for formatting titles.
 * @constant {RegExp}
 */
const LINE_BREAK_PATTERN = /[ \t]*[\n\r]+[ \t]*/g;

/**
 * Object containing the namespaces used in the XML files.
 * @constant {Object.<string, string>}
 */
const NAMESPACES = {
  dc: "http://purl.org/dc/terms/",
  dcam: "http://purl.org/dc/dcam/",
  marcrel: "http://id.loc.gov/vocabulary/relators/",
  pg: "http://www.gutenberg.org/2009/pgterms/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
};

/**
 * Fixes subtitles in the title by replacing line breaks with appropriate separators.
 *
 * @param {string} title - The original title string.
 * @returns {string} - The title with formatted subtitles.
 */
function fixSubtitles(title) {
  let newTitle = title.replace(LINE_BREAK_PATTERN, ": ", 1);
  return newTitle.replace(LINE_BREAK_PATTERN, "; ");
}

/**
 * Parses an XML file to extract information about a book.
 *
 * @param {number|string} id - The identifier of the book.
 * @param {string} xmlFilePath - The path to the XML file.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the book's data.
 * @throws {Error} - Throws an error if the XML file cannot be parsed.
 */
async function getBook(id, xmlFilePath) {
  let document;

  try {
    const xmlContent = fs.readFileSync(xmlFilePath, "utf-8");
    document = new DOMParser().parseFromString(xmlContent, "application/xml");
  } catch (err) {
    throw new Error(`The XML file could not be parsed. ${err}`);
  }

  const root = document.documentElement;
  const book = root.getElementsByTagNameNS(NAMESPACES.pg, "ebook")[0];

  let result = {
    id: parseInt(id, 10),
    title: null,
    authors: [],
    translators: [],
    type: null,
    subjects: [],
    languages: [],
    formats: [],
   // downloads: null,
    bookshelves: [],
    copyright: null,
  };

  const creators = book.getElementsByTagNameNS(NAMESPACES.dc, "creator");

  Array.from(creators).forEach((creator) => {
    let author = { birth: null, death: null };
    let name = creator.getElementsByTagNameNS(NAMESPACES.pg, "name")[0];
    if (!name) return;
    author.name = name.textContent;
    let birth = creator.getElementsByTagNameNS(NAMESPACES.pg, "birthdate")[0];
    if (birth) author.birth = parseInt(birth.textContent, 10);
    let death = creator.getElementsByTagNameNS(NAMESPACES.pg, "deathdate")[0];
    if (death) author.death = parseInt(death.textContent, 10);
    result.authors.push(author);
  });

  const translatorElements = book.getElementsByTagNameNS(
    NAMESPACES.marcrel,
    "trl"
  );

  Array.from(translatorElements).forEach((translatorElement) => {
    let translator = { birth: null, death: null };
    let name = translatorElement.getElementsByTagNameNS(
      NAMESPACES.pg,
      "name"
    )[0];
    if (!name) return;
    translator.name = name.textContent;
    let birth = translatorElement.getElementsByTagNameNS(
      NAMESPACES.pg,
      "birthdate"
    )[0];
    if (birth) translator.birth = parseInt(birth.textContent, 10);
    let death = translatorElement.getElementsByTagNameNS(
      NAMESPACES.pg,
      "deathdate"
    )[0];
    if (death) translator.death = parseInt(death.textContent, 10);
    result.translators.push(translator);
  });

  let title = book.getElementsByTagNameNS(NAMESPACES.dc, "title")[0];
  if (title) {
    result.title = fixSubtitles(title.textContent);
  }

  const subjects = book.getElementsByTagNameNS(NAMESPACES.dc, "subject");
  Array.from(subjects).forEach((subject) => {
    let subjectType = subject.getElementsByTagNameNS(
      NAMESPACES.dcam,
      "memberOf"
    )[0];
    if (!subjectType) return;
    subjectType = subjectType.getAttribute("rdf:resource");
    let value = subject.getElementsByTagNameNS(NAMESPACES.rdf, "value")[0];
    if (value) value = value.textContent;
    if (subjectType === "dc:LCSH") {
      result.subjects.push(value);
    }
  });
  result.subjects.sort();

  const bookshelves = book.getElementsByTagNameNS(NAMESPACES.pg, "bookshelf");
  Array.from(bookshelves).forEach((bookshelf) => {
    let value = bookshelf.getElementsByTagNameNS(NAMESPACES.rdf, "value")[0];
    if (value) result.bookshelves.push(value.textContent);
  });

  let rights = book.getElementsByTagNameNS(NAMESPACES.dc, "rights")[0];
  if (rights.textContent.startsWith("Public domain in the USA.")) {
    result.copyright = false;
  } else if (rights.textContent.startsWith("Copyrighted.")) {
    result.copyright = true;
  } else {
    result.copyright = null;
  }

  const files = book.getElementsByTagNameNS(NAMESPACES.pg, "file");
  Array.from(files).forEach((file) => {
    let contentType = file
      .getElementsByTagNameNS(NAMESPACES.dc, "format")[0]
      .getElementsByTagNameNS(NAMESPACES.rdf, "value")[0];

    if (
      contentType &&
      (!result.formats.some(
        (format) => format.contentType === contentType.textContent
      ) ||
        result.formats.some(
          (format) =>
            format.contentType === contentType.textContent &&
            format.url.includes("noimages")
        ))
    ) {
      let url = file.getAttribute("rdf:about");
      result.formats.push({ contentType: contentType.textContent, url });
    }
  });

  let bookType = book
    .getElementsByTagNameNS(NAMESPACES.dc, "type")[0]
    .getElementsByTagNameNS(NAMESPACES.rdf, "value")[0];
  result.type = bookType ? bookType.textContent : "Text";

  const languages = book.getElementsByTagNameNS(NAMESPACES.dc, "language");
  Array.from(languages).forEach((language) => {
    result.languages.push(
      language.getElementsByTagNameNS(NAMESPACES.rdf, "value")[0].textContent
    );
  });

  return result;
}

export { getBook, fixSubtitles };