import { Readable } from 'stream'

/**
 * Return node like stream so that parsers work.
 * Transform browser's Reader to string, then create a nodejs stream from it
 * @param {object} reader A file stream reader from the browser input
 * @param {number} size Size of data to return
 * @param {boolean} return_chunk whether to return a chunk in string format or a node stream
 */
export async function toNodeStream(reader, size, returnChunk = false) {
  // if in browser, return node like stream so that parsers work
  // Running in browser:
  const nodeStream = new Readable()

  let lineCounter = 0
  let lastString = ''
  let chunkText = ''

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()

    if (done || (lineCounter > size && size !== 0)) {
      reader.cancel()
      break
    }

    // Decode the current chunk to string and prepend the last string
    const string = `${lastString}${decoder.decode(value)}`

    chunkText += string

    // Extract lines from chunk
    const lines = string.split(/\r\n|[\r\n]/g)

    // Save last line, as it might be incomplete
    lastString = lines.pop() || ''

    for (const line of lines) {
      if (lineCounter === size) {
        reader.cancel()
        break
      }
      // Write each string line to our nodejs stream
      nodeStream.push(line + '\r\n')
      lineCounter++
    }
  }

  nodeStream.push(null)

  //return a chunk of the file. Chunk is used when parsing large files in CSV modeule
  if (return_chunk) {
    return chunkText
  }

  return nodeStream
}


export function isFileFromBrowser(file) {
  return file instanceof File
}


/**
 * Read files from the browser chunks
 * @param {object} file A file stream reader from the browser input
 * @param {func} next callback function called for every chunk read
 * @param {func} done callback function called after successful reading
 */
export function readChunk(file, next, done) {
  let fileSize = file.size
  let chunkSize = 4 * 1024 * 1024 
  let offset = 0

  let reader = new FileReader()
  reader.onload = function () {
    if (reader.error) {
      done(reader.error || {})
      return
    }
    offset += reader.result.length
    // callback for handling read chunk
    // TODO: handle errors
    next(reader.result, offset, fileSize)
    if (offset >= fileSize) {
      done(null)
      return
    }
    readNext()
  }

  reader.onerror = function (err) {
    done(err || {})
  }

  function readNext() {
    let fileSlice = file.slice(offset, offset + chunkSize)
    reader.readAsBinaryString(fileSlice)
  }
  readNext()
}
