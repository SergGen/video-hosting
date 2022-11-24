import { getChunkData } from "./get-chunk-data.mjs";
import fs from "fs";
import { pipeline } from "stream";

export const createVideoStreamByRange = ({res, range, fileSize, resolvedPath}) => {
    const { start, end, chunkSize } = getChunkData(range, fileSize);
    const readStream = fs.createReadStream(resolvedPath, {start, end});

    res.writeHead(206, {
     'Content-Range': `bytes ${start}-${end}/${fileSize}`,
     'Accept-Ranges': 'bytes',
     'Content-Length': chunkSize,
     'Content-Type': 'video/mp4'
    });
    pipeline(readStream, res, (err) => {
        if (err && !(err.code === 'ERR_STREAM_PREMATURE_CLOSE')) {
            console.log(err);
        }
    });
}