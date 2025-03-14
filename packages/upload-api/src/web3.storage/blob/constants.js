// S3 Put command has hard-limit of 5GiB.
// By limiting CAR size to 127*(1<<25), we guarantee max-4GiB-padded Filecoin pieces
// and have better utilization of Fil sector space.
// By receiving one more byte, we would immediatly get to 8GiB padded piece.
export const MAX_UPLOAD_SIZE = 127 * (1 << 25)
