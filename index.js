'use strict';
import {sendHomePage} from "./module/send-home-page.mjs";
import {sendVideoFile} from "./module/send-video-file.mjs";
import {sendImage} from "./module/send-image.mjs";
import http from "http";

const runnersByRouts = {
    '/': sendHomePage,
    '/video-stream': (req, res) => sendVideoFile({req, res, pathToVideo: 'video.mp4'}),
    '/img.jpg': sendImage
};

const router = (req, res) => {
    try {
        const url = req.url;
        const runner = runnersByRouts[url];
        if (!runner) {
            res.statusCode = 404;
            res.statusMessage = 'wrong address';
            return res.end();
        }
        return runner(req, res);
    } catch (err) {
        console.error(err);
        res.statusCode = 500;
        res.statusMessage = 'Internal server error';
        res.end();
    }
}

const PORT = 8000;
const server = http.createServer(router);
server.listen(PORT, 'localhost', () => {console.log(`Server started on port: ${PORT}. Link: http://localhost:${PORT}`)})