import http from 'http'
import Cache from 'hybrid-disk-cache'
import request from 'supertest'
import { gzipSync } from 'zlib'
import { serveCache } from '../src/cache-manager'

describe('serve cache', () => {
  const cache = new Cache()
  const lock = new Set<string>()
  const url = '/p1'
  cache.set('body:' + url, gzipSync(Buffer.from('AAA')))
  const data = Buffer.from(JSON.stringify({ 'header-x': 'value-x' }))
  cache.set('header:' + url, data)

  const server = new http.Server(async (req, res) => {
    const { status } = await serveCache(cache, lock, req, res)
    expect(status).toEqual('hit')
  })

  it('cached contents', done => {
    request(server)
      .get(url)
      .expect(200)
      .end((err, res) => {
        expect(err).toBeNull()
        expect(res.text).toEqual('AAA')
        expect(res.header['header-x']).toEqual('value-x')
        done()
      })
  })

  it('skip cache when x-cache-status = update', done => {
    const server = new http.Server(async (req, res) => {
      const { status, stop } = await serveCache(cache, lock, req, res)
      expect(status).toEqual('force')
      expect(stop).toBeFalsy()
      res.end('BBB')
    })
    request(server)
      .get(url)
      .set('accept-encoding', '')
      .set('x-cache-status', 'update')
      .expect(200)
      .end((err, res) => {
        expect(res.text).toEqual('BBB')
        done()
      })
  })
})
