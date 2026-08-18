const fs = require("fs");

async function extractPdf(filePath) {
  const pdfjs = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  const fileBuffer =
    fs.readFileSync(filePath);

  const data = new Uint8Array(
    fileBuffer
  );

  const pdf =
    await pdfjs.getDocument({
      data,
    }).promise;

  const pages = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(pageNumber);

    const content =
      await page.getTextContent();

    const text = content.items
      .map((item) => {
        if ("str" in item) {
          return item.str;
        }

        return "";
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber,
      text,
    });
  }

  const text = pages
    .map(
      (page) =>
        `[Page ${page.pageNumber}]\n${page.text}`
    )
    .join("\n\n");

  return {
    text,
    pages,
    pageCount: pdf.numPages,
  };
}

function chunkText(
  pages,
  maxCharacters = 4000
) {
  const chunks = [];

  for (const page of pages) {
    if (!page.text) {
      continue;
    }

    const words =
      page.text.split(/\s+/);

    let current = [];

    for (const word of words) {
      current.push(word);

      const currentText =
        current.join(" ");

      if (
        currentText.length >=
        maxCharacters
      ) {
        chunks.push({
          pageNumber:
            page.pageNumber,
          text: currentText,
        });

        current = [];
      }
    }

    if (current.length > 0) {
      chunks.push({
        pageNumber:
          page.pageNumber,
        text: current.join(" "),
      });
    }
  }

  return chunks;
}

async function ingestMaterial(
  filePath,
  fileType
) {
  const type =
    fileType.toLowerCase();

  if (type === "pdf") {
    const extracted =
      await extractPdf(filePath);

    return {
      ...extracted,
      chunks: chunkText(
        extracted.pages
      ),
    };
  }

  if (
    type === "txt" ||
    type === "md"
  ) {
    const text =
      fs.readFileSync(
        filePath,
        "utf8"
      );

    const pages = [
      {
        pageNumber: 1,
        text,
      },
    ];

    return {
      text,
      pages,
      pageCount: 1,
      chunks: chunkText(pages),
    };
  }

  throw new Error(
    `Unsupported material type: ${fileType}`
  );
}

module.exports = {
  ingestMaterial,
};