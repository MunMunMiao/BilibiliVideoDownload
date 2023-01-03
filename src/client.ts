import 'reflect-metadata'
import { plainToInstance, Type, Expose } from 'class-transformer'
import {
  combineLatestWith,
  delay,
  from,
  mergeAll,
  Observable,
  of,
  tap,
  toArray,
} from 'rxjs'
import { switchMap, map, concatMap } from 'rxjs/operators'
import { fromFetch } from 'rxjs/fetch'
import { createWriteStream } from 'fs'
import { MultiBar, Presets } from 'cli-progress'
import { join } from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { sync } from 'rimraf'
import prompts from 'prompts'
import process from 'node:process'

export class User {
  @Expose() isLogin = Boolean()
  @Expose() mid = Number()
  @Expose({name: 'uname'}) name = String()
}

export class GetCurrentUserInfoResponse {
  @Expose()
  @Type(() => User)
  data = new User()
}

export class PartItem {
  @Expose({name: 'cid'}) id = Number()
  @Expose() page = Number()
  @Expose() from = String()
  @Expose({name: 'part'}) name = String()
}

export class VideoDetail {
  @Expose() bvid = String()
  @Expose() aid = Number()
  @Expose() pic = String()
  @Expose() title = String()
  @Expose()
  @Type(() => PartItem)
  pages = Array<PartItem>()
}

export class GetVideoInfoResponse {
  @Expose()
  @Type(() => VideoDetail)
  data = new VideoDetail()
}

export class DASHData {
  @Expose() id = Number()
  @Expose() baseUrl = String()
  @Expose() base_url = String()
  @Expose() backupUrl = Array<string>()
  @Expose() backup_url = Array<string>()
  @Expose() bandwidth = Number()
  @Expose() mimeType = String()
  @Expose() mime_type = String()
  @Expose() codecs = String()
  @Expose() width = Number()
  @Expose() height = Number()
  @Expose() frameRate = String()
  @Expose() frame_rate = String()
  @Expose() sar = String()
  @Expose() startWithSap = Number()
  @Expose() start_with_sap = Number()
  @Expose() codecid = Number()
}

export class FLVData {
  @Expose() order = Number()
  @Expose() length = Number()
  @Expose() size = Number()
  @Expose() ahead = String()
  @Expose() vhead = String()
  @Expose() url = String()
  @Expose() backup_url = Array<string>()
}

class DolbyAudio {
  @Expose() type = Number()

  @Expose()
  @Type(() => DASHData)
  audio?: DASHData[]
}

export class DASHDataWrapper {
  @Expose()
  @Type(() => DASHData)
  video = Array<DASHData>()

  @Expose()
  @Type(() => DASHData)
  audio = Array<DASHData>()

  @Expose()
  @Type(() => DolbyAudio)
  dolby = new DolbyAudio()

  // todo
  // @Expose() flac = new DASHData()
}

export class Stream {
  @Expose() from = String()
  @Expose() result = String()
  @Expose() quality = Number()
  @Expose() format = String()
  @Expose() timelength = Number()
  @Expose() accept_format = String()
  @Expose() accept_description = Array<string>()
  @Expose() accept_quality = Array<number>()
  @Expose() video_codecid = Number()
  @Expose() seek_param = String()
  @Expose() seek_type = String()
  @Expose()
  @Type(() => DASHDataWrapper)
  dash?: DASHDataWrapper
  @Expose()
  @Type(() => FLVData)
  durl?: FLVData

  get isDASH(): boolean {
    return /(mp4|hdflv2)/ig.test(this.accept_format) || Object.hasOwn(this, 'dash')
  }

  sort(): void {
    this.accept_quality.sort((a, b) => b - a)
    this.dash?.video.sort((a, b) => b.id - a.id)
    this.dash?.audio.sort((a, b) => b.id - a.id)
    this.dash?.dolby?.audio?.sort((a, b) => b.id - a.id)
  }
}

export class GetVideoStreamResponse {
  @Expose()
  @Type(() => Stream)
  data = new Stream()
}

export interface DownloadOption {
  id: string
  name: string
  partId: number
  partName: string
  url: string
  type: SpecificationType
}

export enum SpecificationType {
  Unset,
  Video,
  Audio,
}

export class VideoSpecification extends Object{
  type = SpecificationType.Unset
  id = Number()
  mimeType?: string
  codecs?: string
  bandwidth?: number
  width?: number
  height?: number
  frameRate?: string
  backupUrl = Array<string>()
  backup_url = Array<string>()
  baseUrl = String()
  base_url = String()

  get bitrate(): string {
    let num = (this.bandwidth ?? 0) / 1000
    num = Math.round(num * 100) / 100
    return `${num}Kbps`
  }

  override toString(): string {
    let str = ''
    str += `[ID]: ${this.id} `
    if (this.codecs) {
      str += `[Codecs]: ${this.codecs} `
    }
    str += `[BitRate]: ${this.bitrate} `
    if (this.width) {
      str += `[Width]: ${this.width} `
    }
    if (this.height) {
      str += `[Height]: ${this.height} `
    }
    if (this.frameRate) {
      str += `[FrameRate]: ${this.frameRate} `
    }
    return str
  }
}

export class StreamSpecification {
  video = new VideoSpecification()
  audio?: VideoSpecification
}

export interface ConvertOption {
  id: string
  name: string
  partName: string
  dir: string
  files: string[]
}

export interface Option {
  token?: string
  userAgent?: string
  cookie?: string
  dir: string
  bvid: string
  selectStream?: boolean
}

export class Client {
  token?: string
  userAgent?: string
  cookie?: string
  dir: string
  selectStream?: boolean
  private bar = new MultiBar({
    // clearOnComplete: true,
    stopOnComplete: true,
    hideCursor: true
  }, Presets.rect)

  constructor(option: Option) {
    this.dir = option.dir
    this.userAgent = option?.userAgent
    this.token = option?.token
    this.cookie = option?.cookie
    this.selectStream = option?.selectStream
  }

  private request(url: string, option?: { id: string }): Observable<Response> {
    const headers: Record<string, string> = {}

    if (this.cookie) {
      headers['Cookie'] = this.cookie
    } else if (this.token) {
      headers['Cookie'] = `SESSDATA=${this.token}`
    }
    if (this.userAgent) {
      headers['User-Agent'] = this.userAgent
    }
    if (option?.id) {
      headers['Referer'] = `https://www.bilibili.com/video/${option.id}`
    }

    return fromFetch(url, {
      headers
    })
  }

  getCurrentUserInfo(): Observable<User> {
    return this.request('https://api.bilibili.com/nav').pipe(
      switchMap(response => {
        if (response.ok) {
          return response.json()
        } else {
          throw new Error(`Get user info error. status: ${response.status}. statusText: ${response.statusText}`)
        }
      }),
      map(resp => {
        const data = plainToInstance(GetCurrentUserInfoResponse, resp, {
          excludeExtraneousValues: true,
          enableImplicitConversion: false
        })
        return data.data
      })
    )
  }

  getVideoInfo(id: string): Observable<VideoDetail> {
    const url = new URL('https://api.bilibili.com/x/web-interface/view')
    url.searchParams.append('bvid', id)

    return this.request(url.toString()).pipe(
      switchMap(response => {
        if (response.ok) {
          return response.json()
        } else {
          throw new Error(`Get video info. status: ${response.status}. statusText: ${response.statusText}`)
        }
      }),
      map(resp => {
        const data = plainToInstance(GetVideoInfoResponse, resp, {
          excludeExtraneousValues: true,
          enableImplicitConversion: false
        })
        return data.data
      })
    )
  }

  private makeVideoSpecification(type: SpecificationType, data: DASHData): VideoSpecification {
    const specification = new VideoSpecification()
    specification.type = type
    specification.id = data.id
    specification.mimeType = data.mimeType
    specification.codecs = data.codecs
    specification.bandwidth = data.bandwidth
    specification.width = data.width
    specification.height = data.height
    specification.frameRate = data.frameRate
    specification.backupUrl = data.backupUrl
    specification.backup_url = data.backup_url
    specification.baseUrl = data.baseUrl
    specification.base_url = data.base_url
    return specification
  }

  getVideoStream(id: string, cid: number, qualityId?: number): Observable<Stream> {
    const url = new URL('https://api.bilibili.com/x/player/playurl')
    url.searchParams.append('bvid', id)
    url.searchParams.append('cid', cid.toString())
    url.searchParams.append('fourk', '1')
    url.searchParams.append('fnval', '4048')
    if (qualityId) {
      url.searchParams.append('qn', qualityId.toString())
    }

    return this.request(url.toString()).pipe(
      switchMap(response => {
        if (response.ok) {
          return response.json()
        } else {
          throw new Error(`Get video stream. status: ${response.status}. statusText: ${response.statusText}`)
        }
      }),
      map(resp => {
        const data = plainToInstance(GetVideoStreamResponse, resp, {
          excludeExtraneousValues: true,
          enableImplicitConversion: false
        })
        return data.data
      })
    )
  }

  private createWriteStreamObservable(response: Response, option: DownloadOption) {
    return new Observable<string>(subscriber => {
      const tmpName = `${option.partId}_${new Date().getTime()}.tmp`
      const total: number = Number(response.headers.get('content-length'))
      let taskName = '[Download]'
      switch (option.type) {
        case SpecificationType.Video:
          taskName = `[Download] [VIDEO] [Title:${option.name}] [Part:${option.partName}]`
          break
        case SpecificationType.Audio:
          taskName = `[Download] [AUDIO] [Title:${option.name}] [Part:${option.partName}]`
          break
      }
      const bar = this.bar.create(total, 0, {taskName}, {
        format: '{taskName} | {bar} | {percentage}%'
      })
      const ws = createWriteStream(tmpName)
      const wbs = new WritableStream({
        write(chunk) {
          ws.write(chunk)
          bar.increment(chunk.byteLength)
        },
        close() {
          ws.close()
          subscriber.next(tmpName)
          subscriber.complete()
        }
      })
      response.body?.pipeTo(wbs)

      return () => {
        bar.stop()
      }
    })
  }

  download(option: DownloadOption) {
    return this.request(option.url, {id: option.id}).pipe(
      switchMap(response => {
        if (response.ok && response.body) {
          return this.createWriteStreamObservable(response, option)
        } else {
          throw new Error(`Download video stream. id: ${option.id}. partId: ${option.partId}`)
        }
      })
    )
  }

  selectStreamSpecification(detail: VideoDetail, part: PartItem, stream: Stream): Observable<StreamSpecification> {
    const video: VideoSpecification[] = []
    const audio: VideoSpecification[] = []
    stream.sort()
    const dash = stream.dash

    if (stream.isDASH && dash) {
      for (const item of dash.video) {
        video.push(this.makeVideoSpecification(SpecificationType.Video, item))
      }

      if (Array.isArray(dash.dolby)) {
        for (const item of dash.dolby) {
          audio.push(this.makeVideoSpecification(SpecificationType.Audio, item))
        }
      } else {
        for (const item of dash.audio) {
          audio.push(this.makeVideoSpecification(SpecificationType.Audio, item))
        }
      }
    }

    if (!this.selectStream) {
      const result = new StreamSpecification()
      result.video = video[0]
      result.audio = audio[0]
      return of<StreamSpecification>(result)
    }

    return from(prompts([
      {
        type: 'select',
        name: 'video',
        message: `[VIDEO] Pick stream [${detail.title}] - [${part.name}]`,
        choices: video.map((item, index) => ({
          title: item.toString(),
          description: item.toString(),
          value: item,
          selected: index === 0
        }))
      },
      {
        type: 'select',
        name: 'audio',
        message: `[AUDIO] Pick stream [${detail.title}] - [${part.name}]`,
        choices: audio.map((item, index) => ({
          title: item.toString(),
          description: item.toString(),
          value: item,
          selected: index === 0
        }))
      }
    ], {})).pipe(
      map(v => {
        if (!(v.video instanceof VideoSpecification) || !(v.audio instanceof VideoSpecification)){
          process.exit(0)
        }
        const result = new StreamSpecification()
        result.video = v.video
        result.audio = v.audio
        return result
      })
    )
  }

  private normalizeString(str: string): string {
    str = str.replace(/[?*]/g, '')
    str = str.replace(/(\/|\|\/)/g, ' ')
    str = str.replace(/:/g, '-')
    str = str.replace(/"/g, '\`')
    str = str.replace(/</g, '(')
    str = str.replace(/>/g, ')')
    return str
  }

  convert(option: ConvertOption): Observable<string> {
    return new Observable<string>(subscriber => {
      const outputPath = join(this.dir, `${this.normalizeString(option.name)}_${option.id}_${this.normalizeString(option.partName)}.mkv`)
      const command = ffmpeg()
      const taskName = `[Convert] [Title:${option.name}] [Part:${option.partName}]`
      const bar = this.bar.create(1, 0, {taskName}, {
        clearOnComplete: true,
        stopOnComplete: true,
        format: '{taskName} | {value}/{total}'
      })
      for (const item of option.files) {
        command.mergeAdd(item)
      }
      command.videoCodec(`copy`)
      command.audioCodec(`copy`)
      command.output(outputPath)
      command.on('error', err => {
        for (const item of option.files) {
          sync(item)
        }
        subscriber.error(err)
      })
      command.on('end', () => {
        for (const item of option.files) {
          sync(item)
        }
        bar.increment()
        subscriber.next(outputPath)
        subscriber.complete()
      })
      command.run()

      return () => {
        bar.stop()
      }
    })
  }

  private batchDownload(options: DownloadOption[]) {
    return from(options).pipe(
      map(opt => this.download(opt)),
      mergeAll(options.length),
      toArray(),
    )
  }

  private batchAnalysis(videoDetail: VideoDetail, parts: PartItem[]) {
    return from(parts).pipe(
      map(part => {
        return this.getVideoStream(videoDetail.bvid, part.id).pipe(
          switchMap(stream => this.selectStreamSpecification(videoDetail, part, stream)),
          combineLatestWith(of(part))
        )
      }),
      mergeAll(1),
      toArray(),
      switchMap(withData => {
        return from(withData).pipe(
          map(data => {
            const specification = data[0]
            const part = data[1]
            return this.getVideoStream(videoDetail.bvid, part.id, specification.video.id).pipe(
              switchMap(stream => {
                const options: DownloadOption[] = []
                stream.sort()

                if (stream.isDASH) {
                  if (specification.video) {
                    options.push({
                      id: videoDetail.bvid,
                      name: videoDetail.title,
                      partId: part.id,
                      partName: part.name,
                      url: specification.video.baseUrl,
                      type: SpecificationType.Video
                    })
                  }
                  if (specification.audio) {
                    options.push({
                      id: videoDetail.bvid,
                      name: videoDetail.title,
                      partId: part.id,
                      partName: part.name,
                      url: specification.audio.baseUrl,
                      type: SpecificationType.Audio
                    })
                  }
                } else if (stream.durl) {
                  options.push({
                    id: videoDetail.bvid,
                    name: videoDetail.title,
                    partId: part.id,
                    partName: part.name,
                    url: stream.durl.url,
                    type: SpecificationType.Video
                  })
                }

                return this.batchDownload(options)
              }),
              map(paths => ({
                id: videoDetail.bvid,
                name: videoDetail.title,
                partName: part.name,
                files: paths,
                dir: this.dir
              }) as ConvertOption),
            )
          }),
          mergeAll(parts.length),
          concatMap(option => this.convert(option)),
          toArray()
        )
      })
    )
  }

  run(id: string) {
    return this.getCurrentUserInfo().pipe(
      switchMap(info => {
        console.table(info)
        return this.getVideoInfo(id)
      }),
      switchMap(info => {
        return this.batchAnalysis(info, info.pages)
      }),
      tap({
        finalize: () => {
          this.bar.stop()
        }
      }),
      delay(100)
    )
  }
}
