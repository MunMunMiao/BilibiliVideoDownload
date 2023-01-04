# BilibiliVideoDownload

[![npm version](https://badge.fury.io/js/bilibili-cli.svg)](https://badge.fury.io/js/bilibili-cli)
[![Publish](https://github.com/MunMunMiao/BilibiliVideoDownload/actions/workflows/main.yml/badge.svg)](https://badge.fury.io/js/bilibili-cli)

> This library relies on [ffmpeg](https://www.ffmpeg.org/download.html), please install and set path

## Quick start
```shell
npx bilibili-cli -b BV1k4411e7Va
```

## Options
```text
Usage: bilibili-cli [options]

Options:
  -b, --bvid <String>        Video BVID
  -t, --token <String>       Value from cookie [SESSDATA] (default: "")
  -d, --dir <String>         Output dir (default: "./")
  -u, --user-agent <String>  User-Agent (default: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36")
  -ss, --select-stream       Select stream (default: false)
  -V, --version              output the version number
  -h, --help                 display help for command
```

## Todo
- 因为流分配的地址太慢了，尝试使用range分片下载
- 优化选择流的title
- 增加选择需要下载的Part，默认全部下载
- 看到DASH里多了个flac，看看是用在什么地方先，难不成是音乐模块那边用的？
- 完善测试文件
