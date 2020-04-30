const fs = require('fs')
const path = require('path')
const axios = require('axios')
const commander = require('commander')
const progressBar = require('progress')
const Ffmpeg = require('fluent-ffmpeg')
const rimraf = require("rimraf")

commander
    .requiredOption('-b, --bv <string>', 'BV id')
    .requiredOption('-c, --cookie <number>', 'SESSDATA')
    .requiredOption('-d, --directory <string>', 'Output directory', './output')

commander.parse(process.argv)

let BVID = null
let SESSDATA = null
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36`
let directory = null
let videoData = null

if (commander.bv){
    BVID = commander.bv
}
if (commander.cookie){
    SESSDATA = commander.cookie
}
if (commander.directory){
    directory = path.join(commander.directory)
}

console.log('Input config:')
console.table({
    BV: BVID,
    SESSDATA: SESSDATA,
    Directory: path.resolve(directory)
})

async function getCurrentUserData(){
    try {
        const result = await axios.get('https://api.bilibili.com/nav', {
            headers: {
                Cookie: `SESSDATA=${ SESSDATA }`,
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
        console.error(err)
    }
}

async function getVideoData(){
    try {
        const result = await axios.get('https://api.bilibili.com/x/web-interface/view', {
            params: {
                bvid: BVID
            },
            headers: {
                Cookie: `SESSDATA=${ SESSDATA }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            let info = {
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
        console.error(err)
    }
}

async function getAcceptQuality(cid){
    try {
        const result = await axios.get('https://api.bilibili.com/x/player/playurl', {
            params: {
                bvid: BVID,
                cid,
                fourk: 1
            },
            headers: {
                Cookie: `SESSDATA=${ SESSDATA }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            return result.data.data.accept_quality.sort((a, b) => b - a)
        }else {
            throw `Error getting video quality`
        }
    }catch (err) {
        console.error(err)
    }
}

async function getVideoUrl(cid, qualityId){
    try {
        const result = await axios.get('https://api.bilibili.com/x/player/playurl', {
            params: {
                bvid: BVID,
                cid,
                fnval: 16,
                qn: qualityId,
                fourk: 1
            },
            headers: {
                Cookie: `SESSDATA=${ SESSDATA }`,
                'User-Agent': userAgent
            }
        })

        if (result.data.code === 0){
            const _data = result.data.data
            const qualityId = _data.accept_quality.sort((a, b) => b - a)[0]
            const video = _data.dash.video.sort((a, b) => b.bandwidth - a.bandwidth)
            const audio = _data.dash.audio.sort((a, b) => b.bandwidth - a.bandwidth)

            return [video[0], audio[0]]
        }else {
            throw `Error getting video download link`
        }
    }catch (err) {
        console.error(err)
    }
}

async function download(part, item) {
    const response = await axios.get(item.baseUrl, {
        responseType: 'stream',
        headers: {
            'User-Agent': userAgent,
            'Referer': `https://www.bilibili.com/video/BV1Qz411b7jr`
        }
    })
    let downloaded = 0
    const total = Number(response.headers['content-length'])
    const bar = new progressBar(`${ item.mimeType } [:bar] :percent :downloaded/:length`, {
        width: 30,
        total: total
    })
    response.data.pipe(fs.createWriteStream(path.join(__dirname, '/tmp', BVID, `${ part.cid }-${ item.id }`)))

    return new Promise((resolve, reject) => {
        response.data.on('data', chunk => {
            downloaded += chunk.length
            bar.tick(chunk.length, {
                downloaded: transform(downloaded),
                length: transform(total)
            })
        })
        response.data.on('end', () => resolve())
        response.data.on('error', err => reject(err))
    })
}

function convert(fileName, part, paths){
    return new Promise((resolve, reject) => {
        if (paths.length <= 0){
            return
        }

        fs.mkdirSync(path.join(directory), { recursive: true })
        const command = Ffmpeg()

        for (const item of paths){
            command.mergeAdd(item)
        }

        command.videoCodec(`copy`)
        command.audioCodec(`copy`)
        command.output(path.join(directory, `${ fileName }_${ BVID }_${ part.cid }.mkv`))

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

function transform(value){
    if (!value || value <= 0){
        return '0 bytes'
    }

    const s = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
    const e = Math.floor(Math.log(value) / Math.log(1024))
    return `${ (value / Math.pow(1024, Math.floor(e))).toFixed(2) }${ s[e] }`
}

async function main(){
    fs.mkdirSync(path.join(__dirname, '/tmp', BVID), { recursive: true })
    await getCurrentUserData()
    videoData = await getVideoData()

    for (const item of videoData.pages){
        const qualityArray = await getAcceptQuality(item.cid)
        const sources = await getVideoUrl(item.cid, qualityArray[0])
        const paths = []

        console.log(`Part: ${ item.page }`)
        console.log(`Name: ${ item.part }`)
        for (const source of sources){
            await download(item, source)
            paths.push(path.join(__dirname, '/tmp', BVID, `${ item.cid }-${ source.id }`))
        }

        await convert(videoData.title, item, paths)
    }

    rimraf.sync(path.join(__dirname, '/tmp', BVID))
    console.log(`Task complete`)
}

main()
