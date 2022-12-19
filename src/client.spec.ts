import { describe, test, expect } from 'vitest'
import { Client, User, VideoDetail, Stream, VideoSpecification } from './client'
import { lastValueFrom } from 'rxjs'

const token = '63e957fb%2C1686843952%2C7e1ee%2Ac2'
const bvid = 'BV1rp4y1e745'

describe('Client', () => {
  const client = new Client({
    token,
    bvid,
    dir: './'
  })

  test('Get current user info', async () => {
    const result = await lastValueFrom(client.getCurrentUserInfo())
    expect(result instanceof User).toBe(true)
  })

  test('Get video info', async () => {
    const result = await lastValueFrom(client.getVideoInfo(bvid))
    expect(result instanceof VideoDetail).toBe(true)
  })

  describe(`Get video. ID: ${bvid}`, async () => {
    const info = await lastValueFrom(client.getVideoInfo(bvid))
    expect(info instanceof VideoDetail).toBe(true)

    for (const part of info.pages) {
      describe(`Get part. id=${part.id}. name=${part.name}`, async () => {
        let stream: Stream
        let streamSpecification: StreamSpecification

        test(`Get video stream`, async () => {
          stream = await lastValueFrom(client.getVideoStream(info.bvid, part.id))
          expect(stream instanceof Stream).toBe(true)
          console.log('stream')
          console.log(stream)
        })

        test(`Select specification`, async () => {
          streamSpecification = await lastValueFrom(client.selectStreamSpecification(stream))
          expect(specification instanceof VideoSpecification).toBe(true)
          console.log('specification')
          console.log(specification)
        })

        test(`Get video stream`, async () => {
          const stream = await lastValueFrom(client.getVideoStream(info.bvid, part.id, specification.id))
          expect(stream instanceof Stream).toBe(true)
          console.log('stream')
          console.log(stream)
        })
      })
    }
  })
})
