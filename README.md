# BilibiliVideoDownload

> This library relies on [ffmpeg](https://www.ffmpeg.org/download.html), please install and set path

- [How to use](#How-to-use)
	- [Download](#Download)
	- [Install dependencies](#Install-dependencies)
	- [Quick start](#Quick-start)
- [Options](#Options)
- [Working at next](#Working-at-next)

## How to use

#### Download
```text
git clone https://github.com/MunMunMiao/BilibiliVideoDownload.git
```

#### Install dependencies
```text
npm install
```

#### Quick start
```text
node bilibili.js -c XXXXX -b BV1k4411e7Va
```

## Options
```text
Usage: bilibili [options]

Options:
  -b, --bv <string>         BV id
  -c, --cookie <string>     SESSDATA
  -d, --directory <string>  Output directory (default: "./output")
  -a, --audio               download audio only
  -h, --help                output usage information
```
