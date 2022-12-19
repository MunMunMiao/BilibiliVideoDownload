# BilibiliVideoDownload

> This library relies on [ffmpeg](https://www.ffmpeg.org/download.html), please install and set path

## Quick start
```shell
npx bilibili-cli -b BV1k4411e7Va
```

## Options
```text
Usage: bilibili-video [options]

Options:
  -b, --bvid <String>        Video BVID
  -t, --token <String>       Value from cookie [SESSDATA] (default: "")
  -d, --dir <String>         Output dir (default: "./")
  -u, --user-agent <String>  User-Agent (default: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36")
  -h, --help                 display help for command
```

## Todo
- 因为流分配的地址太慢了，尝试使用range分片下载
- 优化选择流的title
