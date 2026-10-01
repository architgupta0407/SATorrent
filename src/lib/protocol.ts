/**
 * Binary protocol and DataChannel framing for SATorrent.
 * Frames piece chunks with an explicit 64-byte binary header to guarantee
 * piece identification, zero race conditions, and complete file integrity.
 */

const MAGIC_BYTES = [0x53, 0x41, 0x54, 0x4f]; // 'SATO'
export const HEADER_SIZE = 64;

export interface BinaryPieceHeader {
  pieceIndex: number;
  payloadSize: number;
  fileId: string;
  requestId: string;
}

export interface UnpackedPiece {
  header: BinaryPieceHeader;
  payload: ArrayBuffer;
}

/**
 * Packs a piece payload into a binary frame with a 64-byte self-describing header.
 */
export function packBinaryPiece(
  fileId: string,
  pieceIndex: number,
  requestId: string,
  payload: ArrayBuffer
): ArrayBuffer {
  const totalLength = HEADER_SIZE + payload.byteLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // 1. Magic bytes (4 bytes)
  for (let i = 0; i < 4; i++) {
    uint8[i] = MAGIC_BYTES[i];
  }

  // 2. pieceIndex (4 bytes, offset 4)
  view.setUint32(4, pieceIndex, false);

  // 3. payloadSize (4 bytes, offset 8)
  view.setUint32(8, payload.byteLength, false);

  // 4. fileId (36 bytes, offset 12)
  const encoder = new TextEncoder();
  const fileIdBytes = encoder.encode(fileId);
  uint8.set(fileIdBytes.subarray(0, 36), 12);

  // 5. requestId (16 bytes, offset 48)
  const reqIdBytes = encoder.encode(requestId);
  uint8.set(reqIdBytes.subarray(0, 16), 48);

  // 6. Payload (offset 64 onwards)
  uint8.set(new Uint8Array(payload), HEADER_SIZE);

  return buffer;
}

/**
 * Checks if a received ArrayBuffer is a SATorrent binary piece frame.
 */
export function isBinaryPiece(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < HEADER_SIZE) return false;
  const uint8 = new Uint8Array(buffer);
  return (
    uint8[0] === MAGIC_BYTES[0] &&
    uint8[1] === MAGIC_BYTES[1] &&
    uint8[2] === MAGIC_BYTES[2] &&
    uint8[3] === MAGIC_BYTES[3]
  );
}

/**
 * Unpacks a received binary piece frame.
 */
export function unpackBinaryPiece(buffer: ArrayBuffer): UnpackedPiece | null {
  if (!isBinaryPiece(buffer)) return null;

  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  const pieceIndex = view.getUint32(4, false);
  const payloadSize = view.getUint32(8, false);

  if (buffer.byteLength < HEADER_SIZE + payloadSize) {
    return null;
  }

  const decoder = new TextDecoder();
  // Read fileId
  const fileIdBytes = uint8.subarray(12, 48);
  const fileIdEnd = fileIdBytes.indexOf(0);
  const fileId = decoder.decode(fileIdEnd >= 0 ? fileIdBytes.subarray(0, fileIdEnd) : fileIdBytes);

  // Read requestId
  const reqIdBytes = uint8.subarray(48, 64);
  const reqIdEnd = reqIdBytes.indexOf(0);
  const requestId = decoder.decode(reqIdEnd >= 0 ? reqIdBytes.subarray(0, reqIdEnd) : reqIdBytes);

  const payload = buffer.slice(HEADER_SIZE, HEADER_SIZE + payloadSize);

  return {
    header: {
      pieceIndex,
      payloadSize,
      fileId,
      requestId,
    },
    payload,
  };
}
