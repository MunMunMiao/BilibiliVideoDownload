# BilibiliVideoDownload

> This library relies on [ffmpeg](https://www.ffmpeg.org/download.html), please install and set path

- [How to use](#How to use)
	- [Download](#Download)
	- [Install dependencies](#Install dependencies)
	- [Quick start](#Quick start)
- [Options](#Options)
- [Working at next](#Working at next)

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
  -h, --help                output usage information
```
## Working at next

- Download all videos owned by the user according to the user id
- Add subscription monitoring mode to download users' videos regularly
- Add PM2 support
- Support external configuration file
