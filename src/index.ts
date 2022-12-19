#!/usr/bin/env node
import { Client, Option } from './client'
import { Command } from 'commander'
import process from 'node:process'

const cmd = new Command()
cmd.requiredOption('-b, --bvid <String>', 'Video BVID')
cmd.option('-t, --token <String>', 'Value from cookie [SESSDATA]', '')
cmd.option('-d, --dir <String>', 'Output dir', './')
cmd.option('-u, --user-agent <String>', 'User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36')
cmd.option('-ss, --select-stream', 'Select stream', false)
cmd.parseAsync(process.argv)

const option = cmd.opts<Option>()
const client = new Client(option)

client.run(option.bvid).subscribe({
  error: err => {
    console.error(err)
  }
})
