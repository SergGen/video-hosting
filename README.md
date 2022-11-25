# Как создать поток видеоданных с помощью Node.js

Источник [highload.today](https://highload.today/blogs/kak-sozdat-potok-videodannyh-s-pomoshhyu-node-js-razbirayu-detali-na-svoem-proekte/)

Представленный тут код имеет небольшие исправления, улучшения и дополнения в отличие от оригинала кода, представленного в статье.

## Файл index.js

Здесь мы создали простой сервер, функцией обратного вызова назначили функцию `router`, получающую параметры `request` и `response`. Далее мы проверяем, имеем ли по полученному `request.url` совпадению в нашем объекте `runnersByRouts` по данному имени ключа. Если да — то вызываем соответствующую функцию, если нет — то возвращаем ответ об ошибке к клиенту.
При открытии вкладки в браузере по нашей ссылке на сервер поступает запрос с `url` `/` и мы отдаем нашу страницу, файл `index.html`.

## Файл modules/send-home-page.mjs

Сначала мы находим путь к нашей папке с помощью `resolve(__dirname, '..', 'public', 'index.html')`, назначаем тип контента, который собираемся отправить клиенту `res.setHeader('Content-Type', 'text/html')`, далее создаем читаемый поток `fs.createReadStream(pathHomePage)` и на последней строке вызываем наш поток с помощью функции `pipeline()`.

## Файл index.html

Рассмотрим несколько важных для нас атрибутов в html-элементе `<video>`:

- `src="/video-stream"` — при рендеринге нашей страницы в браузере мы обращаемся к серверу по адресу `http://localhost:8000/video-stream` и получаем наше видео.
- `controls` — этот атрибут позволяет пользователю иметь контроль над видео (старт/пауза, звук и т.п.).
- `preload="auto"` — в спецификации указано, что весь видеофайл может загрузиться даже если пользователь не будет использовать его. Но на практике все зависит от браузера и будет происходить скорее всего более динамично. Например, да — ваше видео будет загружено примерно на 1 мин. наперед и через каждые 5 секунд воспроизведенного видео дозагрузятся еще 5 секунд и т.д.

Поэтому нам поступает запрос с `url` `/video-stream` и мы вызываем нашу функцию `sendVideoFile`.

## Файл modules/send-video-file.mjs

В нашей функции `sendVideoFile` всё начинается с того, что:

1. Мы создаем абсолютный путь к файлу — путь, который нам указали в параметре `pathToVideo`. Было `public/video.mp4` — стало `/your_folder/your_folder/project_folder/public/video.mp4`.
2. `fs.statSync(resolvedPath).size` — узнаем размер файла в байтах.
3. `req.headers.range` — получаем параметр `range` `(bytes=12582912-)`, то есть то, с какой позиции нужно скачивать видео в байтах.

В зависимости от браузера и проигрывателя параметр range может быть `null` или, например, `bytes=123456-`, поэтому у нас есть две различные функции для обработки этих на самом деле разных подходов.

## Файл modules/create-video-stream.mjs

Здесь уже всё просто — код схож с тем, который мы уже рассматривали в `modules/send-home-page.mjs`. Единственная разница в том, что мы назначаем обязательные заголовки `Content-Type` и `Content-Length` для того, чтобы браузер понимал, какого типа мы посылаем ему информацию и какого размера. Это необходимо как для корректной работы проигрывателя, так и для дальнейшего взаимодействия проигрывателя с сервером во время последующих транзакций данных.

И внизу также один из самых частых случаев — когда параметр `range` существует.

## Файл modules/create-video-stream-by-range.mjs

Здесь у нас есть функция getChunkData, которая принимает входящий параметр range и fileSize осуществляет следующие шаги:

1. Берет пару значений из `range = bytes=36634624-` и получает массив `parts = [ '36634624', '' ]`.
2. Вычисляет значение `start = 36896768`, `end = 86890916`, `chunkSize = 49994149`.

## Файл modules/get-chunk-data.js

Также `createVideoStreamByRange` мы указываем обязательным статус ответа `206`, а также `Content-Range` — какую часть данных со всего видео мы отправляем, а также `Accept-Ranges` — в каком формате данные, которые мы отправляем.

Еще несколько дополнений, которые полезно знать:

1. `pipeline` почему лучше использовать `pipeline()`, а не очередь `pipe()` при работе с потоками. В функции `pipeline()` последний аргумент — функция обратного вызова. Мы использовали её в вышеперечисленных примерах кода. Если возникнет ошибка в любом из переданных потоков, то мы её можем обработать в одном месте. Также `pipeline()` самостоятельно закрывает все оконченные, но не закрытые запросы к серверу. Например, когда мы используем `someReadStream(path).pipe(res)`, то после ошибки или окончания передачи данных запрос на сервер скорее всего не закроет, из-за чего возникают непонятные и очень веские ошибки и потеря оперативной памяти. Об этом вы можете почитать подробнее [здесь](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-callback).
2. `highWaterMark` — это значение размера внутреннего буфера, то есть количество данных в байтах, которые мы можем прочитать за один раз, то есть один `chunk` данных (по умолчанию он `64kB`). Также значение `highWaterMark` мы можем изменить при создании потока `fs.createReadStream(path, { highWaterMark: 2 })`, теперь мы считываем наш файл по два символа за раз, а также можем узнать его размер следующим образом: `readStream.readableHighWaterMark`, значение по умолчанию будет `65536` байтов.

## Как работает поток и отправка данных в деталях?

Сначала мы создаем поток по считыванию файла и назначаем его в смену `readStream`, после этого используем его в функции `pipeline()`, далее `chunk` данных передается к потоку `res` (т.е. `response`, если полностью) и тогда `res` его получает и отправляет клиенту с помощью `res.write(chunk)`. Каждый раз когда мы читаем и передаем ему наши `chunk` данные, то в конце, когда уже нет данных для считывания, вызывается событие `end` для каждого потока и функция `pipeline()` самостоятельно закрывает их. Что очень важно, в случае `res` после последнего вызывается `res.end()` и наш запрос к серверу успешно заканчивается.