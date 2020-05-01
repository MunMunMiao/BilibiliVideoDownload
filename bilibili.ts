import { mkdirSync, createWriteStream } from 'fs'
import { join, resolve } from 'path'
import axios from 'axios'
import commander from 'commander'
import progress from 'progress'
import ffmpeg from 'fluent-ffmpeg'
import rimraf from 'rimraf'

commander.requiredOption('-b, --bv <string>', 'BV id')
commander.requiredOption('-c, --cookie <number>', 'SESSDATA')
commander.requiredOption('-d, --directory <string>', 'Output directory', './output')

commander.parse(process.argv)

let BVID: string | null = null
let SESSDATA: string | null = null
const userAgent: string = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36`
let directory: string = './output'
let videoData: VideoData | null = null

if (commander.bv){
    BVID = commander.bv
}
if (commander.cookie){
    SESSDATA = commander.cookie
}
if (commander.directory){
    directory = join(commander.directory)
}

console.log('Input config:')
console.table({
    BV: BVID,
    SESSDATA: SESSDATA,
    Directory: directory ? resolve(directory) : ''
})

interface BaseResponse<T =any> {
    code: number
    message: number
    ttl: number
    data: T
}

interface UserData {
    isLogin: boolean
    email_verified: number
    face: string
    level_info: {
        current_level: number
        current_min: number
        current_exp: number
        next_exp: number
    },
    mid: number
    mobile_verified: number
    money: number
    moral: number
    official: {
        role: number
        title: string
        desc: string
        type: number
    },
    officialVerify: {
        type: number
        desc: string
    },
    pendant: {
        pid: number
        name: string
        image: string
        expire: number
        image_enhance: string
    },
    scores: number
    uname: string
    vipDueDate: number
    vipStatus: number
    vipType: number
    vip_pay_type: number
    vip_theme_type: number
    wallet: {
        mid: number
        bcoin_balance: number
        coupon_balance: number
        coupon_due_time: number
    },
    "has_shop": boolean,
    "shop_url": string
    "allowance_count": number
    "answer_status": number
}

async function getCurrentUserData(): Promise<void>{
    try {
        const result = await axios.get<BaseResponse<UserData>>('https://api.bilibili.com/nav', {
            headers: {
                Cookie: `SESSDATA=${ SESSDATA || '' }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            console.log('Current user:')
            console.table({
                id: result.data.data.mid,
                name: result.data.data.uname,
                isVip: result.data.data.vipStatus === 1
            })
        }else {
            throw `Error getting user information`
        }
    }catch (err) {
        throw new Error(err)
    }
}

interface PartItem {
    cid: number
    page: number
    from: string
    part: string
    duration: number
    vid: string
    weblink: string
    dimension: {
        width: number
        height: number
        rotate: number
    }
}

interface VideoData {
    bvid: string
    aid: number
    videos: number
    tid: number
    tname: string
    copyright: number
    pic: string
    title: string
    pubdate: number
    ctime: number
    desc: string
    state: number
    attribute: number
    duration: number
    pages: PartItem[]
}

async function getVideoData(): Promise<VideoData>{
    try {
        const result = await axios.get<BaseResponse<VideoData>>('https://api.bilibili.com/x/web-interface/view', {
            params: {
                bvid: BVID
            },
            headers: {
                Cookie: `SESSDATA=${ SESSDATA || '' }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            let info: {[key: string]: string} = {
                BV: result.data.data.bvid,
                AV: `AV${ result.data.data.aid }`,
                Title: result.data.data.title,
                // desc: result.data.data.desc
            }

            for (const [index, item] of result.data.data.pages.entries()){
                info[`Part-${ index + 1 }`] = item.part
            }

            console.log('Video data:')
            console.table(info)
            return result.data.data
        }else {
            throw `Error getting video data`
        }
    }catch (err) {
        throw new Error(err)
    }
}

interface DashData {
    duration: number
    minBufferTime: number
    min_buffer_time: number
    video: {
        id: number
        baseUrl: string
        base_url: string
        backupUrl: string[],
        backup_url: string[],
        bandwidth: number
        mimeType: string
        mime_type: string
        codecs: string
        width: number
        height: number
        frameRate: string
        frame_rate: string
        sar: string
        startWithSap: number
        start_with_sap: number
        SegmentBase: {
            Initialization: string
            indexRange: string
        },
        segment_base: {
            initialization: string
            index_range: string
        },
        codecid: number
    }[],
    audio: {
        id: number
        baseUrl: string
        base_url: string
        backupUrl: string[],
        backup_url: string[],
        bandwidth: number
        mimeType: string
        mime_type: string
        codecs: string
        width: number
        height: number
        frameRate: string
        frame_rate: string
        sar: string
        startWithSap: number
        start_with_sap: number
        SegmentBase: {
            Initialization: string
            indexRange: string
        },
        segment_base: {
            initialization: string
            index_range: string
        },
        codecid: number
    }[]
}

interface FlvData {
    order: number
    length: number
    size: number
    ahead: string
    vhead: string
    url: string
    backup_url: string[]
}

class BaseStream{
    constructor(
        public from: string,
        public result: string,
        public message: string,
        public quality: number,
        public format: string,
        public timelength: number,
        public accept_format: string,
        public accept_description: string[],
        public accept_quality: number[],
        public video_codecid: number,
        public seek_param: string,
        public seek_type: string
    ) {}
}

class DashStream{
    get stream() {
        return {
            video: this.dash.video.sort((a, b) => b.bandwidth - a.bandwidth)[0],
            audio: this.dash.audio.sort((a, b) => b.bandwidth - a.bandwidth)[0]
        }
    }

    constructor(
        public from: string,
        public result: string,
        public message: string,
        public quality: number,
        public format: string,
        public timelength: number,
        public accept_format: string,
        public accept_description: string[],
        public accept_quality: number[],
        public video_codecid: number,
        public seek_param: string,
        public seek_type: string,
        public dash: DashData
    ) {}
}

class FlvStream{
    constructor(
        public from: string,
        public result: string,
        public message: string,
        public quality: number,
        public format: string,
        public timelength: number,
        public accept_format: string,
        public accept_description: string[],
        public accept_quality: number[],
        public video_codecid: number,
        public seek_param: string,
        public seek_type: string,
        public durl: FlvData[]
    ) {}
}

async function getAcceptQuality(cid: number): Promise<number[]>{
    try {
        const result = await axios.get<BaseResponse<BaseStream>>('https://api.bilibili.com/x/player/playurl', {
            params: {
                bvid: BVID,
                cid,
                fourk: 1
            },
            headers: {
                Cookie: `SESSDATA=${ SESSDATA || '' }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            return result.data.data.accept_quality.sort((a, b) => b - a)
        }else {
            throw `Failed to obtain video information`
        }
    }catch (err) {
        throw new Error(err)
    }
}

async function getVideoUrl(cid: number, qualityId: number): Promise<DashStream | FlvStream>{
    try {
        const result = await axios.get<BaseResponse>('https://api.bilibili.com/x/player/playurl', {
            params: {
                bvid: BVID,
                cid,
                fnval: 16,
                qn: qualityId,
                fourk: 1
            },
            headers: {
                Cookie: `SESSDATA=${ SESSDATA || '' }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            const _data = result.data.data
            const acceptFormat: string[] = _data.accept_format.split(',')
            if (acceptFormat.includes('mp4') || acceptFormat.includes('hdflv2') && Object.keys(_data).includes('dash')){
                return new DashStream(
                    _data.from,
                    _data.result,
                    _data.message,
                    _data.quality,
                    _data.format,
                    _data.timelength,
                    _data.accept_format,
                    _data.accept_description,
                    _data.accept_quality,
                    _data.video_codecid,
                    _data.seek_param,
                    _data.seek_type,
                    _data.dash
                )
            }else {
                return new FlvStream(
                    _data.from,
                    _data.result,
                    _data.message,
                    _data.quality,
                    _data.format,
                    _data.timelength,
                    _data.accept_format,
                    _data.accept_description,
                    _data.accept_quality,
                    _data.video_codecid,
                    _data.seek_param,
                    _data.seek_type,
                    _data.durl
                )
            }
        }else {
            throw `Error getting video download link`
        }
    }catch (err) {
        throw new Error(err)
    }
}

async function download(part: PartItem, url: string, type?: string): Promise<string>{
    const response = await axios.get(url, {
        responseType: 'stream',
        headers: {
            'User-Agent': userAgent,
            'Referer': `https://www.bilibili.com/video/BV1Qz411b7jr`
        }
    })
    let downloaded: number = 0
    const contentType: string = type || String(response.headers['content-type'])
    const total: number = Number(response.headers['content-length'])
    const filePath: string = join(__dirname, '/tmp', `${ part.cid }-${ total }`)
    // @ts-ignore
    const bar = new progress(`${ contentType } [:bar] :percent :downloaded/:length`, {
        width: 30,
        total: total
    })
    response.data.pipe(createWriteStream(filePath))

    return new Promise<string>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            bar.tick(chunk.length, {
                downloaded: transform(downloaded),
                length: transform(total)
            })
        })
        response.data.on('end', () => resolve(filePath))
        response.data.on('error', (err: any) => reject(err))
    })
}

function convert(fileName: string, part: PartItem, paths: string[]){
    return new Promise((resolve, reject) => {
        if (paths.length <= 0){
            return
        }

        mkdirSync(join(directory), { recursive: true })
        const command = ffmpeg()

        for (const item of paths){
            command.mergeAdd(item)
        }

        command.videoCodec(`copy`)
        command.audioCodec(`copy`)
        command.output(join(directory, `${ fileName }_${ BVID }_${ part.cid }.mkv`))

        command.on('error', err => {
            for (const item of paths){
                rimraf.sync(item)
            }
            reject(err)
        })
        command.on('end', () => {
            for (const item of paths){
                rimraf.sync(item)
            }
            console.log(`Convert complete`)
            resolve()
        })

        command.run()
    })
}

function transform(value?: number): string{
    if (!value || value <= 0){
        return '0 bytes'
    }

    const s = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
    const e = Math.floor(Math.log(value) / Math.log(1024))
    return `${ (value / Math.pow(1024, Math.floor(e))).toFixed(2) }${ s[e] }`
}

async function main(): Promise<void>{
    if (!BVID){
        return
    }

    mkdirSync(join(__dirname, '/tmp'), { recursive: true })

    await getCurrentUserData()
    videoData = await getVideoData()

    for (const item of videoData.pages){
        const qualityArray = await getAcceptQuality(item.cid)
        const stream = await getVideoUrl(item.cid, qualityArray[0])
        const paths = []

        console.log(`Part: ${ item.page }`)
        console.log(`Name: ${ item.part }`)
        if (stream instanceof DashStream){
            const videoPath = await download(item, stream.dash.video[0].baseUrl, stream.dash.video[0].mimeType)
            const audioPath = await download(item, stream.dash.audio[0].baseUrl, stream.dash.audio[0].mimeType)
            paths.push(videoPath)
            paths.push(audioPath)
        }

        if (stream instanceof FlvStream){
            const filePath = await download(item, stream.durl[0].url)
            paths.push(filePath)
        }

        await convert(videoData.title, item, paths)
    }

    rimraf.sync(join(__dirname, '/tmp'))
    console.log(`Task complete`)
}

main()
