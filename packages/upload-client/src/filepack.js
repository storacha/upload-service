/**
 * Encode bytes as a Filepack data archive Blob.
 *
 * @param {Iterable<Uint8Array>} chunks
 * @returns {Blob}
 */
export const encodeDataArchive = (chunks) => new Blob([...chunks])
