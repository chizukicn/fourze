import { isFormData } from "../utils";

export type PolyfillDataValue = string | Buffer | Uint8Array;

export class PolyfillFile {
  readonly fileName: string;
  readonly body: Buffer;
  readonly contentType: string;

  readonly encoding = "binary";

  get size() {
    return this.body.length;
  }

  constructor(
    init: string,
    fileName: string,
    encoding: BufferEncoding = "binary",
    contentType = "application/octet-stream"
  ) {
    this.fileName = fileName;
    this.body = Buffer.from(init, encoding);
    this.contentType = contentType;
  }
}

interface FormDataPart {
  name: string;
  fileName?: string;
  value: string;
  contentType: string;
  encoding?: BufferEncoding;
}

const CONTENT_DISPOSITION_REGEX
  = /Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/;

function decodeFormDataDisposition(data: string) {
  const match = data.match(CONTENT_DISPOSITION_REGEX);
  if (!match) {
    return null;
  }
  return {
    name: match[1],
    filename: match[2] as string | undefined
  };
}

export function decodeFormData(
  data: string | Buffer | Uint8Array | FormData,
  boundary: string
) {
  if (isFormData(data)) {
    const rs: Record<string, any> = {};
    data.forEach((value, key) => {
      rs[key] = value;
    });
    return rs;
  }

  data = Buffer.from(data).toString("binary");

  data = data.replace(`--${boundary}--\r\n`, "");

  const chunks = data.split(`--${boundary}\r\n`);

  const body: Record<string, PolyfillFile | string> = {};

  for (let i = 0; i < chunks.length; i++) {
    let data = chunks[i];

    const part = {} as FormDataPart;

    function readLine() {
      const index = data.indexOf("\r\n");
      if (index < 0) {
        return data;
      }
      const line = data.slice(0, index);
      data = data.slice(index + 2);
      return line;
    }

    let line = readLine();

    if (line.startsWith("Content-Disposition:")) {
      const disposition = decodeFormDataDisposition(line);
      if (disposition) {
        part.name = disposition.name;
        if (disposition.filename) {
          part.fileName = Buffer.from(disposition.filename, "binary").toString("utf-8");
        }
      }
      line = readLine();
    }

    if (line.startsWith("Content-Type:")) {
      part.contentType = line.slice(14);
      line = readLine();
    }
    if (line.startsWith("Content-Transfer-Encoding:")) {
      part.encoding = line.slice(26) as BufferEncoding;
      line = readLine();
    }

    data = data.slice(0, -2);

    if (data.length > 0) {
      part.value = data;
    }

    if (!part.name) {
      continue;
    }

    if (part.fileName) {
      body[part.name] = new PolyfillFile(
        part.value,
        part.fileName,
        part.encoding,
        part.contentType
      );
    } else {
      body[part.name] = part.value;
    }
  }
  return body;
}
